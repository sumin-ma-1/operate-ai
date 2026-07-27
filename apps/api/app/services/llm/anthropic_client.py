from __future__ import annotations

from typing import Any

import httpx

from app.services.llm.types import ChatResult


DEFAULT_ANTHROPIC_MODELS = [
    "claude-sonnet-4-20250514",
    "claude-3-5-haiku-latest",
    "claude-3-5-sonnet-latest",
]


class AnthropicClient:
    provider = "anthropic"
    supports_tools = False

    def __init__(self, api_key: str) -> None:
        if not api_key.strip():
            raise ValueError(
                "Anthropic API key is not configured. Add it in Models → Providers."
            )
        self.api_key = api_key.strip()
        self.base_url = "https://api.anthropic.com/v1"

    def _headers(self) -> dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

    async def list_models(self) -> list[str]:
        return list(DEFAULT_ANTHROPIC_MODELS)

    async def chat(
        self,
        model: str,
        user_message: str,
        system_message: str | None = None,
        images: list[str] | None = None,
    ) -> str:
        content: Any = user_message
        if images:
            content = [
                {"type": "text", "text": user_message},
                *[
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image.split(",", 1)[-1]
                            if image.startswith("data:")
                            else image,
                        },
                    }
                    for image in images
                ],
            ]
        messages = [{"role": "user", "content": content}]
        result = await self.chat_messages(
            model=model,
            messages=(
                [{"role": "system", "content": system_message}, *messages]
                if system_message
                else messages
            ),
        )
        return result.content

    async def chat_messages(
        self,
        model: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatResult:
        if tools:
            raise ValueError(
                "Tools are not supported for Anthropic in this version. "
                "Disable tools on the LLM node or use Ollama/OpenAI."
            )

        system = None
        api_messages: list[dict[str, Any]] = []
        for message in messages:
            role = message.get("role")
            if role == "system":
                system = message.get("content") or system
                continue
            if role not in {"user", "assistant"}:
                continue
            content = message.get("content")
            if content is None:
                content = ""
            api_messages.append({"role": role, "content": content})

        if not api_messages:
            raise ValueError("No messages to send to Anthropic")

        payload: dict[str, Any] = {
            "model": model,
            "max_tokens": 4096,
            "messages": api_messages,
        }
        if system:
            payload["system"] = system

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/messages",
                headers=self._headers(),
                json=payload,
            )
            if response.is_error:
                detail = response.text.strip() or response.reason_phrase
                raise ValueError(f"Anthropic error ({response.status_code}): {detail}")
            data = response.json()

        blocks = data.get("content") or []
        text_parts = [
            block.get("text", "")
            for block in blocks
            if isinstance(block, dict) and block.get("type") == "text"
        ]
        return ChatResult(content="".join(text_parts), tool_calls=[], raw_message=data)
