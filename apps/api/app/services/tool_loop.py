"""LLM agent loop that runs Ollama tool calls until a final answer."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from app.services.ollama import OllamaService
from app.services.tools import resolve_tool_schemas, run_tool


def _clamp_rounds(value: int | None) -> int:
    if value is None:
        return 5
    return max(1, min(10, int(value)))


def _summarize_tool_result(result: str, limit: int = 160) -> str:
    text = " ".join(result.split())
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


async def run_tool_loop(
    *,
    ollama: OllamaService,
    model: str,
    system_message: str | None,
    user_message: str,
    images: list[str] | None,
    enabled_tools: list[str] | None,
    max_tool_rounds: int | None,
    node_id: str,
) -> AsyncIterator[dict[str, Any]]:
    """Yield SSE-friendly events; final event is tool_loop_completed with output."""

    tools = resolve_tool_schemas(enabled_tools)
    if not tools:
        content = await ollama.chat(
            model=model,
            user_message=user_message,
            system_message=system_message,
            images=images,
        )
        yield {"type": "tool_loop_completed", "nodeId": node_id, "output": content}
        return

    messages: list[dict[str, Any]] = []
    if system_message:
        messages.append({"role": "system", "content": system_message})

    user_payload: dict[str, Any] = {"role": "user", "content": user_message}
    if images:
        user_payload["images"] = images
    messages.append(user_payload)

    rounds = _clamp_rounds(max_tool_rounds)

    for round_index in range(rounds):
        yield {
            "type": "tool_round",
            "nodeId": node_id,
            "message": (
                f"Calling Ollama ({model})"
                if round_index == 0
                else f"Calling Ollama again ({model})"
            ),
            "round": round_index + 1,
        }

        result = await ollama.chat_messages(
            model=model,
            messages=messages,
            tools=tools,
        )

        assistant_message: dict[str, Any] = {
            "role": "assistant",
            "content": result.content or "",
        }
        if result.tool_calls:
            # Prefer raw message when present so Ollama gets its own tool_call shape.
            if result.raw_message:
                assistant_message = {
                    "role": "assistant",
                    **{
                        key: value
                        for key, value in result.raw_message.items()
                        if key in {"content", "tool_calls"}
                    },
                }
            else:
                assistant_message["tool_calls"] = [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.name,
                            "arguments": call.arguments,
                        },
                    }
                    for call in result.tool_calls
                ]

        messages.append(assistant_message)

        if not result.tool_calls:
            yield {
                "type": "tool_loop_completed",
                "nodeId": node_id,
                "output": result.content or "",
            }
            return

        for call in result.tool_calls:
            args_preview = ", ".join(
                f"{key}={value!r}"
                for key, value in list(call.arguments.items())[:3]
            )
            yield {
                "type": "tool_started",
                "nodeId": node_id,
                "toolName": call.name,
                "args": call.arguments,
                "message": (
                    f"Searching the web: {call.arguments.get('query')}"
                    if call.name == "web_search" and call.arguments.get("query")
                    else f"Running {call.name}"
                    + (f" ({args_preview})" if args_preview else "")
                ),
            }

            try:
                tool_output = await run_tool(call.name, call.arguments)
            except Exception as exc:
                tool_output = f"Tool error: {exc}"

            yield {
                "type": "tool_completed",
                "nodeId": node_id,
                "toolName": call.name,
                "summary": _summarize_tool_result(tool_output),
                "message": (
                    f"Received search results"
                    if call.name == "web_search"
                    else f"Finished {call.name}"
                ),
            }

            messages.append(
                {
                    "role": "tool",
                    "tool_name": call.name,
                    "content": tool_output,
                    **({"tool_call_id": call.id} if call.id else {}),
                }
            )

    # Exhausted rounds — ask for a final answer without tools.
    yield {
        "type": "tool_round",
        "nodeId": node_id,
        "message": f"Finalizing answer ({model})",
        "round": rounds + 1,
    }
    final = await ollama.chat_messages(model=model, messages=messages, tools=None)
    yield {
        "type": "tool_loop_completed",
        "nodeId": node_id,
        "output": final.content or "",
    }
