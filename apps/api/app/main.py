from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import (
    ExecuteWorkflowRequest,
    ExecuteWorkflowResponse,
    WorkflowDefinition,
    WorkflowSummary,
)
from app.services.executor import DAGExecutor
from app.services.ollama import OllamaService
from app.services.workflow_store import WorkflowStore

app = FastAPI(title="Operate-AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|100\.\d+\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ollama_service = OllamaService()
executor = DAGExecutor(ollama_service)
workflow_store = WorkflowStore()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/models")
async def list_models() -> dict:
    try:
        models = await ollama_service.list_models()
        return {"models": models}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Ollama unavailable: {exc}") from exc


@app.post(
    "/execute",
    response_model=ExecuteWorkflowResponse,
    response_model_by_alias=True,
)
async def execute_workflow(request: ExecuteWorkflowRequest) -> ExecuteWorkflowResponse:
    try:
        return await executor.execute(request)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Workflow execution failed: {exc}",
        ) from exc


@app.get(
    "/workflows",
    response_model=list[WorkflowSummary],
    response_model_by_alias=True,
)
async def list_workflows() -> list[WorkflowSummary]:
    return workflow_store.list_workflows()


@app.get(
    "/workflows/{workflow_id}",
    response_model=WorkflowDefinition,
    response_model_by_alias=True,
)
async def get_workflow(workflow_id: str) -> WorkflowDefinition:
    workflow = workflow_store.get_workflow(workflow_id)
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@app.post(
    "/workflows",
    response_model=WorkflowDefinition,
    response_model_by_alias=True,
)
async def save_workflow(workflow: WorkflowDefinition) -> WorkflowDefinition:
    return workflow_store.save_workflow(workflow)


@app.delete("/workflows/{workflow_id}")
async def delete_workflow(workflow_id: str) -> dict[str, bool]:
    deleted = workflow_store.delete_workflow(workflow_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"deleted": True}
