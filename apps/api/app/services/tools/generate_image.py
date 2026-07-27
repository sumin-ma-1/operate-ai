"""Local Stable Diffusion WebUI Forge (A1111) txt2img."""

from __future__ import annotations

import json
import os
from typing import Any

import httpx

from app.config import FORGE_BASE_URL, FORGE_DEFAULT_CHECKPOINT
from app.services.forge_store import forge_store

GENERATE_IMAGE_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "generate_image",
        "description": (
            "Generate an image with the local Stable Diffusion WebUI Forge "
            "(AUTOMATIC1111-compatible API). Use when the user asks for a picture, "
            "illustration, concept art, or visual mockup."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "Positive text-to-image prompt",
                },
                "negative_prompt": {
                    "type": "string",
                    "description": "Optional negative prompt",
                    "default": "",
                },
                "model": {
                    "type": "string",
                    "description": (
                        "Optional Forge checkpoint name (e.g. model.safetensors). "
                        "Omit to use the node or global default."
                    ),
                },
                "width": {
                    "type": "integer",
                    "description": "Image width in pixels (64-1024, multiple of 8)",
                    "default": 512,
                },
                "height": {
                    "type": "integer",
                    "description": "Image height in pixels (64-1024, multiple of 8)",
                    "default": 512,
                },
                "steps": {
                    "type": "integer",
                    "description": "Sampling steps (1-40)",
                    "default": 20,
                },
            },
            "required": ["prompt"],
        },
    },
}


def _clamp_dim(value: Any, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    parsed = max(64, min(1024, parsed))
    return parsed - (parsed % 8)


def _clamp_steps(value: Any, default: int = 20) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(1, min(40, parsed))


def resolve_forge_checkpoint(
    arguments: dict[str, Any],
    node_checkpoint: str | None = None,
) -> str:
    """Tool arg > node override > saved default > env > empty (Forge UI active)."""
    for candidate in (
        str(arguments.get("model") or "").strip(),
        (node_checkpoint or "").strip(),
        forge_store.get_default_checkpoint(),
        FORGE_DEFAULT_CHECKPOINT,
    ):
        if candidate:
            return candidate
    return ""


async def generate_image(
    arguments: dict[str, Any],
    *,
    node_checkpoint: str | None = None,
) -> str:
    prompt = str(arguments.get("prompt") or "").strip()
    if not prompt:
        raise ValueError("generate_image requires a non-empty prompt")

    negative = str(arguments.get("negative_prompt") or "").strip()
    width = _clamp_dim(arguments.get("width"), 512)
    height = _clamp_dim(arguments.get("height"), 512)
    steps = _clamp_steps(arguments.get("steps"), 20)
    checkpoint = resolve_forge_checkpoint(arguments, node_checkpoint)

    base = (os.getenv("FORGE_BASE_URL") or FORGE_BASE_URL).rstrip("/")
    url = f"{base}/sdapi/v1/txt2img"
    payload: dict[str, Any] = {
        "prompt": prompt,
        "negative_prompt": negative,
        "width": width,
        "height": height,
        "steps": steps,
        "cfg_scale": 7,
    }
    if checkpoint:
        payload["override_settings"] = {"sd_model_checkpoint": checkpoint}

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            response = await client.post(url, json=payload)
    except httpx.HTTPError as exc:
        raise ValueError(
            f"Forge request failed ({base}). Is Stable Diffusion WebUI Forge running "
            f"with --api? {exc}"
        ) from exc

    if response.is_error:
        detail = response.text.strip() or response.reason_phrase
        raise ValueError(
            f"Forge error ({response.status_code}) at {url}: {detail}. "
            "Ensure Forge is running with the API enabled (e.g. --api)."
        )

    try:
        data = response.json()
    except json.JSONDecodeError as exc:
        raise ValueError("Forge returned non-JSON response") from exc

    images = data.get("images") or []
    if not images:
        raise ValueError("Forge returned no images")

    raw = str(images[0])
    if "," in raw and raw.strip().startswith("data:"):
        raw = raw.split(",", 1)[1]

    result: dict[str, Any] = {
        "ok": True,
        "mimeType": "image/png",
        "imageBase64": raw,
        "width": width,
        "height": height,
        "prompt": prompt,
    }
    if checkpoint:
        result["checkpoint"] = checkpoint

    return json.dumps(result, ensure_ascii=False)
