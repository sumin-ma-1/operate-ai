import json
from datetime import datetime, timezone
from pathlib import Path

from app.config import DATA_DIR
from app.schemas import WorkflowDefinition, WorkflowSummary


class WorkflowStore:
    def __init__(self, data_dir: Path = DATA_DIR) -> None:
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def _file_path(self, workflow_id: str) -> Path:
        return self.data_dir / f"{workflow_id}.json"

    def list_workflows(self) -> list[WorkflowSummary]:
        summaries: list[WorkflowSummary] = []
        for file_path in sorted(self.data_dir.glob("*.json")):
            with file_path.open("r", encoding="utf-8") as file:
                data = json.load(file)
            summaries.append(
                WorkflowSummary(
                    id=data["id"],
                    name=data.get("name", "Untitled"),
                    createdAt=data.get("createdAt"),
                    updatedAt=data.get("updatedAt"),
                )
            )
        return summaries

    def get_workflow(self, workflow_id: str) -> WorkflowDefinition | None:
        file_path = self._file_path(workflow_id)
        if not file_path.exists():
            return None
        with file_path.open("r", encoding="utf-8") as file:
            data = json.load(file)
        return WorkflowDefinition.model_validate(data)

    def save_workflow(self, workflow: WorkflowDefinition) -> WorkflowDefinition:
        now = datetime.now(timezone.utc).isoformat()
        existing = self.get_workflow(workflow.id)
        workflow.created_at = (
            existing.created_at if existing and existing.created_at else now
        )
        workflow.updated_at = now

        payload = workflow.model_dump(by_alias=True)
        file_path = self._file_path(workflow.id)
        with file_path.open("w", encoding="utf-8") as file:
            json.dump(payload, file, indent=2, ensure_ascii=False)

        return workflow

    def delete_workflow(self, workflow_id: str) -> bool:
        file_path = self._file_path(workflow_id)
        if not file_path.exists():
            return False
        file_path.unlink()
        return True
