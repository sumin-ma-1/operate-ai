"""Local API keys for cloud LLM providers (never stored in workflows)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import SECRETS_PATH

CLOUD_PROVIDERS = ("openai", "anthropic", "gemini")


def _empty_providers() -> dict[str, Any]:
    return {
        "openai": {"apiKey": ""},
        "anthropic": {"apiKey": ""},
        "gemini": {"apiKey": ""},
    }


def _empty() -> dict[str, Any]:
    return {**_empty_providers(), "nodeOverrides": {}}


class SecretsStore:
    def __init__(self, path: Path = SECRETS_PATH) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _read(self) -> dict[str, Any]:
        if not self.path.exists():
            return _empty()
        try:
            with self.path.open("r", encoding="utf-8") as file:
                data = json.load(file)
            if not isinstance(data, dict):
                return _empty()
            merged = _empty()
            for key in CLOUD_PROVIDERS:
                entry = data.get(key) or {}
                if isinstance(entry, dict):
                    merged[key]["apiKey"] = str(entry.get("apiKey") or "")
            overrides = data.get("nodeOverrides") or {}
            if isinstance(overrides, dict):
                cleaned: dict[str, Any] = {}
                for node_id, providers in overrides.items():
                    if not isinstance(providers, dict):
                        continue
                    node_entry: dict[str, str] = {}
                    for provider in CLOUD_PROVIDERS:
                        value = providers.get(provider)
                        if isinstance(value, str) and value.strip():
                            node_entry[provider] = value.strip()
                    if node_entry:
                        cleaned[str(node_id)] = node_entry
                merged["nodeOverrides"] = cleaned
            return merged
        except (json.JSONDecodeError, OSError):
            return _empty()

    def _write(self, data: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as file:
            json.dump(data, file, indent=2)

    def get_api_key(self, provider: str, node_id: str | None = None) -> str:
        if provider not in CLOUD_PROVIDERS:
            return ""
        data = self._read()
        if node_id:
            override = (data.get("nodeOverrides") or {}).get(node_id) or {}
            if isinstance(override, dict):
                node_key = override.get(provider) or ""
                if node_key:
                    return node_key
        return (data.get(provider) or {}).get("apiKey") or ""

    def update_keys(self, updates: dict[str, str | None]) -> dict[str, Any]:
        data = self._read()
        for provider, value in updates.items():
            if provider not in CLOUD_PROVIDERS:
                continue
            if value is None:
                continue
            data[provider]["apiKey"] = value.strip()
        self._write(data)
        return self.public_view()

    def get_node_override_view(self, node_id: str) -> dict[str, Any]:
        data = self._read()
        overrides = (data.get("nodeOverrides") or {}).get(node_id) or {}
        return {
            provider: {
                "configured": bool(overrides.get(provider)),
                "apiKeyMasked": self.mask_key(str(overrides.get(provider) or "")),
                "usingGlobal": not bool(overrides.get(provider)),
            }
            for provider in CLOUD_PROVIDERS
        }

    def set_node_override(
        self, node_id: str, provider: str, api_key: str | None
    ) -> dict[str, Any]:
        if provider not in CLOUD_PROVIDERS:
            raise ValueError(f"Unknown provider: {provider}")
        data = self._read()
        overrides: dict[str, Any] = dict(data.get("nodeOverrides") or {})
        node_entry: dict[str, str] = dict(overrides.get(node_id) or {})
        if api_key is None or not api_key.strip():
            node_entry.pop(provider, None)
        else:
            node_entry[provider] = api_key.strip()
        if node_entry:
            overrides[node_id] = node_entry
        else:
            overrides.pop(node_id, None)
        data["nodeOverrides"] = overrides
        self._write(data)
        return self.get_node_override_view(node_id)

    @staticmethod
    def mask_key(api_key: str) -> str:
        key = api_key.strip()
        if not key:
            return ""
        if len(key) <= 8:
            return "••••••••"
        return f"{key[:3]}…{key[-4:]}"

    def public_view(self) -> dict[str, Any]:
        raw = self._read()
        return {
            provider: {
                "configured": bool(raw[provider]["apiKey"]),
                "apiKeyMasked": self.mask_key(raw[provider]["apiKey"]),
            }
            for provider in CLOUD_PROVIDERS
        }


secrets_store = SecretsStore()
