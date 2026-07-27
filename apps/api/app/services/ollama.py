"""Backward-compatible re-export of Ollama client. """

from app.services.llm.ollama_client import OllamaClient, OllamaService
from app.services.llm.types import ChatResult, ToolCall

__all__ = ["OllamaClient", "OllamaService", "ChatResult", "ToolCall"]
