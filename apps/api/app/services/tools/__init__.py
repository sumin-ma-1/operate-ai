"""Built-in tool registry for LLM tool calling."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from app.services.tools.web_search import WEB_SEARCH_SCHEMA, web_search

ToolHandler = Callable[[dict[str, Any]], Awaitable[str]]

TOOL_SCHEMAS: dict[str, dict[str, Any]] = {
    "web_search": WEB_SEARCH_SCHEMA,
}

TOOL_HANDLERS: dict[str, ToolHandler] = {
    "web_search": web_search,
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


async def run_tool(name: str, arguments: dict[str, Any]) -> str:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        raise ValueError(f"Unknown tool: {name}")
    return await handler(arguments)
