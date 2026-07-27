from __future__ import annotations

from typing import Any

import httpx

from app.services.llm.types import ChatResult


DEFAULT_GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
]


class GeminiClient:
    provider = "gemini"
    supports_tools = False

    def __init__(self, api_key: str) -> None:
        if not api_key.strip():
            raise ValueError(
                "Gemini API key is not configured. Add it in Models → Providers."
            )
        self.api_key = api_key.strip()
        self.base_url = "https://generativelanguage.googleapis.com/v1beta"

    async def list_models(self) -> list[str]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    params={"key": self.api_key},
                )
                if response.is_error:
                    return list(DEFAULT_GEMINI_MODELS)
                data = response.json()
                names: list[str] = []
                for item in data.get("models") or []:
                    name = item.get("name") or ""
                    methods = item.get("supportedGenerationMethods") or []
                    if "generateContent" not in methods:
                        continue
                    short = name.split("/")[-1] if name else ""
                    if short:
                        names.append(short)
                return names[:40] or list(DEFAULT_GEMINI_MODELS)
        except Exception:
            return list(DEFAULT_GEMINI_MODELS)

    async def chat(
        self,
        model: str,
        user_message: str,
        system_message: str | None = None,
        images: list[str] | None = None,
    ) -> str:
        parts: list[dict[str, Any]] = [{"text": user_message}]
        if images:
            for image in images:
                raw = image.split(",", 1)[-1] if image.startswith("data:") else image
                parts.append(
                    {"inline_data": {"mime_type": "image/png", "data": raw}}
                )
        messages = [{"role": "user", "parts": parts}]
        if system_message:
            # Prepend system as user context for broad compatibility
            messages.insert(
                0,
                {"role": "user", "parts": [{"text": f"[System]\n{system_message}"}]},
            )
            messages.insert(1, {"role": "model", "parts": [{"text": "Understood."}]})
        result = await self.chat_messages(model=model, messages=messages)
        return result.content

    async def chat_messages(
        self,
        model: str,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> ChatResult:
        if tools:
            raise ValueError(
                "Tools are not supported for Gemini in this version. "
                "Disable tools on the LLM node or use Ollama/OpenAI."
            )

        system_bits: list[str] = []
        contents: list[dict[str, Any]] = []

        for message in messages:
            role = message.get("role")
            content = message.get("content")
            if role == "system":
                if isinstance(content, str) and content:
                    system_bits.append(content)
                continue

            if "parts" in message:
                gemini_role = "user" if role in {None, "user"} else "model"
                if role == "assistant":
                    gemini_role = "model"
                contents.append({"role": gemini_role, "parts": message["parts"]})
                continue

            text = content if isinstance(content, str) else str(content or "")
            if role == "assistant":
                contents.append({"role": "model", "parts": [{"text": text}]})
            elif role == "user":
                parts: list[dict[str, Any]] = [{"text": text}]
                for image in message.get("images") or []:
                    raw = (
                        image.split(",", 1)[-1]
                        if str(image).startswith("data:")
                        else image
                    )
                    parts.append(
                        {"inline_data": {"mime_type": "image/png", "data": raw}}
                    )
                contents.append({"role": "user", "parts": parts})

        if not contents:
            raise ValueError("No messages to send to Gemini")

        payload: dict[str, Any] = {"contents": contents}
        if system_bits:
            payload["systemInstruction"] = {
                "parts": [{"text": "\n\n".join(system_bits)}]
            }

        model_id = model if model.startswith("models/") else model
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/models/{model_id}:generateContent",
                params={"key": self.api_key},
                json=payload,
            )
            if response.is_error:
                detail = response.text.strip() or response.reason_phrase
                raise ValueError(f"Gemini error ({response.status_code}): {detail}")
            data = response.json()

        candidates = data.get("candidates") or []
        parts_out = (
            ((candidates[0] or {}).get("content") or {}).get("parts") or []
            if candidates
            else []
        )
        text = "".join(
            part.get("text", "")
            for part in parts_out
            if isinstance(part, dict)
        )
        return ChatResult(content=text, tool_calls=[], raw_message=data)
