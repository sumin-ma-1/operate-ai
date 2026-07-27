"""Stable Diffusion WebUI Forge (A1111-compatible) API client."""

from __future__ import annotations

import os
from typing import Any

import httpx

from app.config import FORGE_BASE_URL


def _base_url() -> str:
    return (os.getenv("FORGE_BASE_URL") or FORGE_BASE_URL).rstrip("/")


async def list_checkpoints() -> list[dict[str, Any]]:
    url = f"{_base_url()}/sdapi/v1/sd-models"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
    except httpx.HTTPError as exc:
        raise ValueError(
            f"Forge unavailable at {_base_url()}. Is it running with --api? {exc}"
        ) from exc

    if response.is_error:
        detail = response.text.strip() or response.reason_phrase
        raise ValueError(f"Forge error ({response.status_code}): {detail}")

    data = response.json()
    if not isinstance(data, list):
        return []

    checkpoints: list[dict[str, Any]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or item.get("model_name") or "").strip()
        model_name = str(item.get("model_name") or title).strip()
        if not title:
            continue
        checkpoints.append(
            {
                "title": title,
                "modelName": model_name,
            }
        )
    return checkpoints


async def get_active_checkpoint() -> str:
    url = f"{_base_url()}/sdapi/v1/options"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
    except httpx.HTTPError as exc:
        raise ValueError(
            f"Forge unavailable at {_base_url()}. Is it running with --api? {exc}"
        ) from exc

    if response.is_error:
        detail = response.text.strip() or response.reason_phrase
        raise ValueError(f"Forge error ({response.status_code}): {detail}")

    data = response.json()
    if not isinstance(data, dict):
        return ""
    return str(data.get("sd_model_checkpoint") or "").strip()
