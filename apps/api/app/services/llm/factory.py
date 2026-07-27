from __future__ import annotations

from typing import Any

from app.services.llm.anthropic_client import AnthropicClient, DEFAULT_ANTHROPIC_MODELS
from app.services.llm.gemini_client import GeminiClient
from app.services.llm.ollama_client import OllamaClient
from app.services.llm.openai_client import OpenAIClient
from app.services.secrets_store import secrets_store

PROVIDERS = ("ollama", "openai", "anthropic", "gemini")


def get_llm_client(provider: str | None, node_id: str | None = None) -> Any:
    name = (provider or "ollama").strip().lower() or "ollama"
    if name == "ollama":
        return OllamaClient()
    if name == "openai":
        return OpenAIClient(secrets_store.get_api_key("openai", node_id))
    if name == "anthropic":
        return AnthropicClient(secrets_store.get_api_key("anthropic", node_id))
    if name == "gemini":
        return GeminiClient(secrets_store.get_api_key("gemini", node_id))
    raise ValueError(f"Unknown LLM provider: {provider}")


async def build_model_catalog(ollama: OllamaClient) -> list[dict[str, Any]]:
    catalog: list[dict[str, Any]] = []

    try:
        ollama_models = await ollama.list_models()
        names = [
            item.get("name")
            for item in ollama_models
            if isinstance(item, dict) and item.get("name")
        ]
    except Exception:
        names = []
    catalog.append(
        {
            "provider": "ollama",
            "label": "Ollama",
            "configured": True,
            "supportsTools": True,
            "models": names,
        }
    )

    openai_key = secrets_store.get_api_key("openai")
    openai_models: list[str] = []
    if openai_key:
        try:
            openai_models = await OpenAIClient(openai_key).list_models()
        except Exception:
            openai_models = []
    catalog.append(
        {
            "provider": "openai",
            "label": "OpenAI",
            "configured": bool(openai_key),
            "supportsTools": True,
            "models": openai_models,
        }
    )

    anthropic_key = secrets_store.get_api_key("anthropic")
    # Anthropic has no public models list API — curated ids for the dropdown.
    catalog.append(
        {
            "provider": "anthropic",
            "label": "Anthropic",
            "configured": bool(anthropic_key),
            "supportsTools": False,
            "models": list(DEFAULT_ANTHROPIC_MODELS),
        }
    )

    gemini_key = secrets_store.get_api_key("gemini")
    gemini_models: list[str] = []
    if gemini_key:
        try:
            gemini_models = await GeminiClient(gemini_key).list_models()
        except Exception:
            gemini_models = []
    catalog.append(
        {
            "provider": "gemini",
            "label": "Gemini",
            "configured": bool(gemini_key),
            "supportsTools": False,
            "models": gemini_models,
        }
    )

    return catalog
