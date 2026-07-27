"""Run Python scripts locally with timeout, temp cwd, and no network."""

from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from pathlib import Path
from typing import Any

from app.config import PYTHON_TOOL_TIMEOUT_SECONDS

RUN_PYTHON_SCHEMA: dict[str, Any] = {
    "type": "function",
    "function": {
        "name": "run_python",
        "description": (
            "Execute a Python script on this machine and return stdout/stderr. "
            "Use for calculations, parsing, data transforms, and short programs. "
            "Network access is disabled. Prefer relative paths in the working directory. "
            "Do not attempt pip install."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Python source code to execute (multi-line OK)",
                },
            },
            "required": ["code"],
        },
    },
}

_MAX_OUTPUT_CHARS = 100_000
_PRELUDE = r"""
import socket as _socket

def _blocked_socket(*args, **kwargs):
    raise OSError("Network is disabled for the run_python tool")

_socket.socket = _blocked_socket  # type: ignore[misc,assignment]
"""


def _timeout_seconds() -> int:
    try:
        value = int(
            os.getenv("PYTHON_TOOL_TIMEOUT_SECONDS") or PYTHON_TOOL_TIMEOUT_SECONDS
        )
    except ValueError:
        value = PYTHON_TOOL_TIMEOUT_SECONDS
    return max(1, min(120, value))


def _truncate(text: str) -> str:
    if len(text) <= _MAX_OUTPUT_CHARS:
        return text
    return text[: _MAX_OUTPUT_CHARS - 1] + "…"


async def run_python(arguments: dict[str, Any]) -> str:
    code = str(arguments.get("code") or "")
    if not code.strip():
        raise ValueError("run_python requires non-empty code")

    timeout = _timeout_seconds()
    with tempfile.TemporaryDirectory(prefix="operate-ai-py-") as tmp:
        script_path = Path(tmp) / "script.py"
        script_path.write_text(_PRELUDE + "\n" + code, encoding="utf-8")

        try:
            process = await asyncio.create_subprocess_exec(
                sys.executable,
                str(script_path),
                cwd=tmp,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={
                    **os.environ,
                    "PYTHONUNBUFFERED": "1",
                    "PYTHONDONTWRITEBYTECODE": "1",
                },
            )
            try:
                stdout_b, stderr_b = await asyncio.wait_for(
                    process.communicate(), timeout=timeout
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                raise ValueError(
                    f"run_python timed out after {timeout}s"
                ) from None
        except FileNotFoundError as exc:
            raise ValueError(f"Python executable not found: {sys.executable}") from exc

    stdout = _truncate(stdout_b.decode("utf-8", errors="replace"))
    stderr = _truncate(stderr_b.decode("utf-8", errors="replace"))
    code_exit = process.returncode if process.returncode is not None else -1

    parts: list[str] = [f"exit_code={code_exit}"]
    if stdout:
        parts.append(f"stdout:\n{stdout}")
    if stderr:
        parts.append(f"stderr:\n{stderr}")
    if not stdout and not stderr:
        parts.append("(no output)")
    return "\n\n".join(parts)
