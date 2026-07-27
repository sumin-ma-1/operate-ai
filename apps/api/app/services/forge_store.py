"""Local default Forge checkpoint (not stored in workflows)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import DATA_ROOT

FORGE_SETTINGS_PATH = DATA_ROOT / "forge_settings.json"


class ForgeStore:
    def __init__(self, path: Path = FORGE_SETTINGS_PATH) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _read(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"defaultCheckpoint": ""}
        try:
            with self.path.open("r", encoding="utf-8") as file:
                data = json.load(file)
            if not isinstance(data, dict):
                return {"defaultCheckpoint": ""}
            return {
                "defaultCheckpoint": str(data.get("defaultCheckpoint") or "").strip()
            }
        except (json.JSONDecodeError, OSError):
            return {"defaultCheckpoint": ""}

    def _write(self, data: dict[str, Any]) -> None:
        with self.path.open("w", encoding="utf-8") as file:
            json.dump(data, file, indent=2)

    def get_default_checkpoint(self) -> str:
        return self._read()["defaultCheckpoint"]

    def set_default_checkpoint(self, checkpoint: str | None) -> dict[str, str]:
        data = self._read()
        data["defaultCheckpoint"] = (checkpoint or "").strip()
        self._write(data)
        return {"defaultCheckpoint": data["defaultCheckpoint"]}


forge_store = ForgeStore()
