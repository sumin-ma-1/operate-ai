from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import OLLAMA_BASE_URL


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any] = field(default_factory=dict)


@dataclass
class ChatResult:
    content: str
    tool_calls: list[ToolCall] = field(default_factory=list)
    raw_message: dict[str, Any] = field(default_factory=dict)


def _parse_tool_calls(message: dict[str, Any]) -> list[ToolCall]:
    raw_calls = message.get("tool_calls") or []
    parsed: list[ToolCall] = []

    for index, call in enumerate(raw_calls):
        if not isinstance(call, dict):
            continue
        function = call.get("function") or {}
        name = function.get("name") or call.get("name") or ""
        if not name:
            continue

        arguments = function.get("arguments", call.get("arguments", {}))
        if isinstance(arguments, str):
            import json

            try:
                arguments = json.loads(arguments)
            except json.JSONDecodeError:
                arguments = {"raw": arguments}
        if not isinstance(arguments, dict):
            arguments = {"value": arguments}

        parsed.append(
            ToolCall(
                id=str(call.get("id") or f"call_{index}"),
                name=name,
                arguments=arguments,
            )
        )

    return parsed


class OllamaService:
    def __init__(self, base_url: str = OLLAMA_BASE_URL) -> None:
        self.base_url = base_url.rstrip("/")

    async def list_models(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{self.base_url}/api/tags")
            response.raise_for_status()
            data = response.json()
            return data.get("models", [])

    async def chat(
        self,
        model: str,
        user_message: str,
        system_message: str | None = None,
        images: list[str] | None = None,
    ) -> str:
        messages: list[dict] = []
        if system_message:
            messages.append({"role": "system", "content": system_message})

        user_payload: dict = {"role": "user", "content": user_message}
        if images:
            user_payload["images"] = images
        messages.append(user_payload)

        result = await self.chat_messages(model=model, messages=messages)
        return result.content

    async def chat_messages(
        self,
        model: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatResult:
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": False,
        }
        if tools:
            payload["tools"] = tools

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json=payload,
            )
            if response.status_code == 404:
                raise ValueError(
                    f"Ollama model '{model}' not found. "
                    f"Pull it with `ollama pull {model}` or pick an installed model."
                )
            if response.is_error:
                detail = response.text.strip() or response.reason_phrase
                raise ValueError(f"Ollama error ({response.status_code}): {detail}")
            data = response.json()

        message = data.get("message") or {}
        content = message.get("content") or ""
        tool_calls = _parse_tool_calls(message)
        return ChatResult(
            content=content,
            tool_calls=tool_calls,
            raw_message=message,
        )
