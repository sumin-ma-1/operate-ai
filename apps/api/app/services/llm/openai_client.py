from __future__ import annotations

import json
from typing import Any

import httpx

from app.services.llm.types import ChatResult, parse_openai_style_tool_calls


class OpenAIClient:
    provider = "openai"
    supports_tools = True

    def __init__(self, api_key: str) -> None:
        if not api_key.strip():
            raise ValueError("OpenAI API key is not configured. Add it in Models → Providers.")
        self.api_key = api_key.strip()
        self.base_url = "https://api.openai.com/v1"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers=self._headers(),
                )
                if response.is_error:
                    return []
                data = response.json()
                names = [
                    item.get("id")
                    for item in data.get("data") or []
                    if isinstance(item, dict) and item.get("id")
                ]
                chatish = [
                    name
                    for name in names
                    if any(
                        token in name
                        for token in ("gpt-4", "gpt-3.5", "o1", "o3", "o4")
                    )
                ]
                return sorted(chatish)[:40]
        except Exception:
            return []

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
        content: Any = user_message
        if images:
            content = [
                {"type": "text", "text": user_message},
                *[
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/png;base64,{image}"
                            if not image.startswith("data:")
                            else image
                        },
                    }
                    for image in images
                ],
            ]
        messages.append({"role": "user", "content": content})
        result = await self.chat_messages(model=model, messages=messages)
        return result.content

    def _normalize_messages(
        self, messages: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for message in messages:
            role = message.get("role")
            if role == "tool":
                normalized.append(
                    {
                        "role": "tool",
                        "tool_call_id": message.get("tool_call_id")
                        or message.get("id")
                        or "call",
                        "content": message.get("content") or "",
                    }
                )
                continue
            if role == "assistant" and message.get("tool_calls"):
                normalized.append(
                    {
                        "role": "assistant",
                        "content": message.get("content") or None,
                        "tool_calls": message.get("tool_calls"),
                    }
                )
                continue
            # Drop Ollama-only image field; multimodal should already be content parts
            entry = {k: v for k, v in message.items() if k != "images"}
            if "images" in message and isinstance(message.get("content"), str):
                images = message["images"]
                entry["content"] = [
                    {"type": "text", "text": message["content"]},
                    *[
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image}"
                                if not str(image).startswith("data:")
                                else image
                            },
                        }
                        for image in images
                    ],
                ]
            normalized.append(entry)
        return normalized

    async def chat_messages(
        self,
        model: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatResult:
        payload: dict[str, Any] = {
            "model": model,
            "messages": self._normalize_messages(messages),
        }
        if tools:
            payload["tools"] = tools

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            if response.is_error:
                detail = response.text.strip() or response.reason_phrase
                raise ValueError(f"OpenAI error ({response.status_code}): {detail}")
            data = response.json()

        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        content = message.get("content") or ""
        if isinstance(content, list):
            content = "".join(
                part.get("text", "")
                for part in content
                if isinstance(part, dict)
            )
        tool_calls = parse_openai_style_tool_calls(message)
        # Ensure tool_calls arguments are strings for follow-up OpenAI rounds
        raw = dict(message)
        if tool_calls and raw.get("tool_calls"):
            fixed = []
            for call in raw["tool_calls"]:
                fn = dict(call.get("function") or {})
                args = fn.get("arguments")
                if isinstance(args, dict):
                    fn["arguments"] = json.dumps(args)
                fixed.append({**call, "function": fn})
            raw["tool_calls"] = fixed
        return ChatResult(content=content or "", tool_calls=tool_calls, raw_message=raw)
