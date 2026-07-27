"""Shared LLM chat types and protocol."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


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


class LLMClient(Protocol):
    provider: str
    supports_tools: bool

    async def chat(
        self,
        model: str,
        user_message: str,
        system_message: str | None = None,
        images: list[str] | None = None,
    ) -> str: ...

    async def chat_messages(
        self,
        model: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatResult: ...


def parse_openai_style_tool_calls(message: dict[str, Any]) -> list[ToolCall]:
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
