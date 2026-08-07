"""Entry point for the PyInstaller-bundled Operate AI API."""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Dev fallback: allow `python packaging/run_api.py` from repo root.
if not getattr(sys, "frozen", False):
    api_root = Path(__file__).resolve().parent.parent / "apps" / "api"
    sys.path.insert(0, str(api_root))

import uvicorn


def main() -> None:
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.main:app", host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
