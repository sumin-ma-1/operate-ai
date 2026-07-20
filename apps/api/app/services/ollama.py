import httpx

from app.config import OLLAMA_BASE_URL


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

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.base_url}/api/chat",
                json={"model": model, "messages": messages, "stream": False},
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
            return data.get("message", {}).get("content", "")
