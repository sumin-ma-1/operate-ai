from __future__ import annotations

from typing import Any

import httpx

from app.config import OLLAMA_BASE_URL
from app.services.llm.types import ChatResult, parse_openai_style_tool_calls


class OllamaClient:
    provider = "ollama"
    supports_tools = True

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
                    f"Pull it in Models → Ollama or run `ollama pull {model}`."
                )
            if response.is_error:
                detail = response.text.strip() or response.reason_phrase
                raise ValueError(f"Ollama error ({response.status_code}): {detail}")
            data = response.json()

        message = data.get("message") or {}
        content = message.get("content") or ""
        tool_calls = parse_openai_style_tool_calls(message)
        return ChatResult(
            content=content,
            tool_calls=tool_calls,
            raw_message=message,
        )

    async def pull_model_stream(self, name: str):
        """Yield NDJSON status dicts from Ollama pull."""
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/pull",
                json={"name": name, "stream": True},
            ) as response:
                if response.is_error:
                    detail = (await response.aread()).decode("utf-8", errors="replace")
                    raise ValueError(
                        f"Ollama pull failed ({response.status_code}): {detail}"
                    )
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    import json

                    try:
                        yield json.loads(line)
                    except json.JSONDecodeError:
                        yield {"status": line}

    async def delete_model(self, name: str) -> None:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.request(
                "DELETE",
                f"{self.base_url}/api/delete",
                json={"name": name},
            )
            if response.is_error:
                detail = response.text.strip() or response.reason_phrase
                raise ValueError(
                    f"Ollama delete failed ({response.status_code}): {detail}"
                )


# Back-compat alias used across the codebase
OllamaService = OllamaClient
