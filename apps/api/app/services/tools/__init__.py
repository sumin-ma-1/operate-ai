"""Built-in tool registry for LLM tool calling."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from app.services.tools.generate_image import (
    GENERATE_IMAGE_SCHEMA,
    generate_image,
)
from app.services.tools.run_python import RUN_PYTHON_SCHEMA, run_python
from app.services.tools.web_search import WEB_SEARCH_SCHEMA, web_search

ToolContext = dict[str, Any]
ToolHandler = Callable[[dict[str, Any], ToolContext], Awaitable[str]]

TOOL_SCHEMAS: dict[str, dict[str, Any]] = {
    "web_search": WEB_SEARCH_SCHEMA,
    "generate_image": GENERATE_IMAGE_SCHEMA,
    "run_python": RUN_PYTHON_SCHEMA,
}


async def _run_web_search(arguments: dict[str, Any], _context: ToolContext) -> str:
    return await web_search(arguments)


async def _run_generate_image(arguments: dict[str, Any], context: ToolContext) -> str:
    node_checkpoint = context.get("forge_checkpoint")
    return await generate_image(
        arguments,
        node_checkpoint=str(node_checkpoint) if node_checkpoint else None,
    )


async def _run_python(arguments: dict[str, Any], _context: ToolContext) -> str:
    return await run_python(arguments)


TOOL_HANDLERS: dict[str, ToolHandler] = {
    "web_search": _run_web_search,
    "generate_image": _run_generate_image,
    "run_python": _run_python,
}


def resolve_tool_schemas(enabled_tools: list[str] | None) -> list[dict[str, Any]]:
    if not enabled_tools:
        return []
    schemas: list[dict[str, Any]] = []
    for name in enabled_tools:
        schema = TOOL_SCHEMAS.get(name)
        if schema:
            schemas.append(schema)
    return schemas


async def run_tool(
    name: str,
    arguments: dict[str, Any],
    context: ToolContext | None = None,
) -> str:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        raise ValueError(f"Unknown tool: {name}")
    return await handler(arguments, context or {})
