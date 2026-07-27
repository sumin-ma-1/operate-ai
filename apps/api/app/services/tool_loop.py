"""LLM agent loop that runs provider tool calls until a final answer."""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

from app.services.llm.types import LLMClient
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


def _parse_generate_image_payload(
    tool_output: str,
) -> tuple[str, str | None]:
    """Return (message_for_model, raw_base64_or_none)."""
    try:
        data = json.loads(tool_output)
    except json.JSONDecodeError:
        return tool_output, None
    if not isinstance(data, dict) or not data.get("ok"):
        return tool_output, None
    raw = data.get("imageBase64")
    if not isinstance(raw, str) or not raw.strip():
        return tool_output, None
    mime = str(data.get("mimeType") or "image/png")
    width = data.get("width")
    height = data.get("height")
    prompt = data.get("prompt") or ""
    summary = {
        "ok": True,
        "mimeType": mime,
        "width": width,
        "height": height,
        "prompt": prompt,
        "note": "Image generated successfully; binary omitted from this message.",
    }
    return json.dumps(summary, ensure_ascii=False), raw.strip()


def _tool_started_message(name: str, arguments: dict[str, Any]) -> str:
    if name == "web_search" and arguments.get("query"):
        return f"Searching the web: {arguments.get('query')}"
    if name == "generate_image" and arguments.get("prompt"):
        prompt = str(arguments.get("prompt"))
        short = prompt if len(prompt) <= 80 else prompt[:79] + "…"
        return f"Generating image: {short}"
    if name == "run_python":
        return "Running Python"
    args_preview = ", ".join(
        f"{key}={value!r}" for key, value in list(arguments.items())[:3]
    )
    return f"Running {name}" + (f" ({args_preview})" if args_preview else "")


def _tool_completed_message(name: str) -> str:
    if name == "web_search":
        return "Received search results"
    if name == "generate_image":
        return "Image generated"
    if name == "run_python":
        return "Python finished"
    return f"Finished {name}"


async def run_tool_loop(
    *,
    client: LLMClient,
    model: str,
    system_message: str | None,
    user_message: str,
    images: list[str] | None,
    enabled_tools: list[str] | None,
    max_tool_rounds: int | None,
    node_id: str,
    forge_checkpoint: str | None = None,
) -> AsyncIterator[dict[str, Any]]:
    """Yield SSE-friendly events; final event is tool_loop_completed with output."""

    provider = getattr(client, "provider", "llm")
    tools = resolve_tool_schemas(enabled_tools)
    if tools and not getattr(client, "supports_tools", False):
        raise ValueError(
            f"Tools are not supported for provider '{provider}'. "
            "Disable tools on the LLM node or switch to Ollama/OpenAI."
        )

    if not tools:
        content = await client.chat(
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
    generated_images: list[str] = []

    for round_index in range(rounds):
        yield {
            "type": "tool_round",
            "nodeId": node_id,
            "message": (
                f"Calling {provider} ({model})"
                if round_index == 0
                else f"Calling {provider} again ({model})"
            ),
            "round": round_index + 1,
        }

        result = await client.chat_messages(
            model=model,
            messages=messages,
            tools=tools,
        )

        assistant_message: dict[str, Any] = {
            "role": "assistant",
            "content": result.content or "",
        }
        if result.tool_calls:
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
            completed: dict[str, Any] = {
                "type": "tool_loop_completed",
                "nodeId": node_id,
                "output": result.content or "",
            }
            if generated_images:
                completed["images"] = generated_images
            yield completed
            return

        new_images_this_round: list[str] = []

        for call in result.tool_calls:
            yield {
                "type": "tool_started",
                "nodeId": node_id,
                "toolName": call.name,
                "args": call.arguments,
                "message": _tool_started_message(call.name, call.arguments),
            }

            try:
                tool_output = await run_tool(
                    call.name,
                    call.arguments,
                    {"forge_checkpoint": forge_checkpoint},
                )
            except Exception as exc:
                tool_output = f"Tool error: {exc}"

            model_content = tool_output
            completed_event: dict[str, Any] = {
                "type": "tool_completed",
                "nodeId": node_id,
                "toolName": call.name,
                "summary": _summarize_tool_result(tool_output),
                "message": _tool_completed_message(call.name),
            }

            if call.name == "generate_image" and not tool_output.startswith(
                "Tool error:"
            ):
                model_content, raw_b64 = _parse_generate_image_payload(tool_output)
                if raw_b64:
                    generated_images.append(raw_b64)
                    new_images_this_round.append(raw_b64)
                    completed_event["summary"] = "Image ready"
                    completed_event["hasImage"] = True

            yield completed_event

            messages.append(
                {
                    "role": "tool",
                    "tool_name": call.name,
                    "content": model_content,
                    **({"tool_call_id": call.id} if call.id else {}),
                }
            )

        if new_images_this_round:
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "The generate_image tool produced the attached image(s). "
                        "Describe or use them as needed to answer the user."
                    ),
                    "images": new_images_this_round,
                }
            )

    yield {
        "type": "tool_round",
        "nodeId": node_id,
        "message": f"Finalizing answer ({model})",
        "round": rounds + 1,
    }
    final = await client.chat_messages(model=model, messages=messages, tools=None)
    completed_final: dict[str, Any] = {
        "type": "tool_loop_completed",
        "nodeId": node_id,
        "output": final.content or "",
    }
    if generated_images:
        completed_final["images"] = generated_images
    yield completed_final
