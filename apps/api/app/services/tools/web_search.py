"""DuckDuckGo HTML web search (no API key)."""

from __future__ import annotations

import html
import json
import re
from typing import Any
from urllib.parse import unquote

import httpx

WEB_SEARCH_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "web_search",
        "description": (
            "Search the public web for up-to-date information. "
            "Use when the user asks about current events, facts you are unsure about, "
            "or anything that benefits from live web results."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of results to return (1-8)",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
    },
}


def _strip_tags(value: str) -> str:
    text = re.sub(r"<[^>]+>", " ", value)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def _decode_ddg_url(href: str) -> str:
    match = re.search(r"uddg=([^&]+)", href)
    if match:
        return unquote(match.group(1))
    if href.startswith("http"):
        return href
    return unquote(href)


async def web_search(arguments: dict[str, Any]) -> str:
    query = str(arguments.get("query") or "").strip()
    if not query:
        raise ValueError("web_search requires a non-empty query")

    try:
        max_results = int(arguments.get("max_results") or 5)
    except (TypeError, ValueError):
        max_results = 5
    max_results = max(1, min(8, max_results))

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; OperateAI/0.1; +https://localhost) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
    }

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.post(
                "https://html.duckduckgo.com/html/",
                data={"q": query},
                headers=headers,
            )
            response.raise_for_status()
            page = response.text
    except httpx.HTTPError as exc:
        raise ValueError(f"Web search request failed: {exc}") from exc

    results: list[dict[str, str]] = []
    link_pattern = re.compile(
        r'<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',
        re.DOTALL | re.IGNORECASE,
    )
    snippet_pattern = re.compile(
        r'class="result__snippet"[^>]*>(.*?)</(?:a|td|div)',
        re.DOTALL | re.IGNORECASE,
    )

    for match in link_pattern.finditer(page):
        if len(results) >= max_results:
            break
        href = _decode_ddg_url(match.group(1))
        title = _strip_tags(match.group(2))
        snippet_match = snippet_pattern.search(page, match.end())
        snippet = _strip_tags(snippet_match.group(1)) if snippet_match else ""
        if not title:
            continue
        results.append({"title": title, "url": href, "snippet": snippet})

    if not results:
        raise ValueError(
            "Web search returned no results. "
            "The search provider may be blocked or unavailable."
        )

    return json.dumps(
        {"query": query, "results": results},
        ensure_ascii=False,
    )
