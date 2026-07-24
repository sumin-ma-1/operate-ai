from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import (
    COMMUNITY_PUBLISH_RATE_LIMIT,
    COMMUNITY_PUBLISH_RATE_WINDOW_SECONDS,
)
from app.schemas import (
    ApprovalDecisionRequest,
    CommunityPost,
    CommunityPostSummary,
    DeleteCommunityRequest,
    ExecuteWorkflowRequest,
    ExecuteWorkflowResponse,
    PublishCommunityRequest,
    WorkflowDefinition,
    WorkflowSummary,
)
from app.services.community_sanitize import strip_large_attachments
from app.services.community_store import CommunityStore
from app.services.executor import DAGExecutor
from app.services.ollama import OllamaService
from app.services.rate_limit import SlidingWindowRateLimiter
from app.services.run_registry import run_registry
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
community_store = CommunityStore()
publish_rate_limiter = SlidingWindowRateLimiter(
    COMMUNITY_PUBLISH_RATE_LIMIT,
    COMMUNITY_PUBLISH_RATE_WINDOW_SECONDS,
)


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _new_workflow_id() -> str:
    import time

    return f"wf-{int(time.time() * 1000):x}"


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


@app.post("/execute/stream")
async def execute_workflow_stream(request: ExecuteWorkflowRequest) -> StreamingResponse:
    async def event_generator():
        try:
            async for event in executor.execute_stream(request):
                yield executor.format_sse(event)
        except Exception as exc:
            yield executor.format_sse(
                {"type": "failed", "error": f"Workflow execution failed: {exc}"}
            )

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.post("/execute/decision")
async def submit_approval_decision(request: ApprovalDecisionRequest) -> dict[str, bool]:
    try:
        run_registry.submit_decision(
            request.run_id,
            request.action,
            request.edited_content,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"ok": True}


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


@app.get(
    "/community",
    response_model=list[CommunityPostSummary],
    response_model_by_alias=True,
)
async def list_community(
    q: str | None = None,
    tag: str | None = None,
    sort: str = "newest",
) -> list[CommunityPostSummary]:
    if sort not in {"newest", "forks"}:
        raise HTTPException(status_code=400, detail="sort must be newest or forks")
    return community_store.list_posts(q=q, tag=tag, sort=sort)  # type: ignore[arg-type]


@app.get(
    "/community/{post_id}",
    response_model=CommunityPost,
    response_model_by_alias=True,
)
async def get_community_post(post_id: str) -> CommunityPost:
    post = community_store.get_post(post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Community post not found")
    return post


@app.post(
    "/community",
    response_model=CommunityPost,
    response_model_by_alias=True,
)
async def publish_community(
    payload: PublishCommunityRequest,
    request: Request,
) -> CommunityPost:
    if not publish_rate_limiter.allow(_client_key(request)):
        raise HTTPException(
            status_code=429,
            detail="Publish rate limit exceeded. Try again later.",
        )

    snapshot = strip_large_attachments(payload.workflow)
    return community_store.publish(
        author_name=payload.author_name,
        title=payload.title,
        description=payload.description,
        tags=payload.tags,
        workflow=snapshot,
    )


@app.post(
    "/community/{post_id}/fork",
    response_model=WorkflowDefinition,
    response_model_by_alias=True,
)
async def fork_community_post(post_id: str) -> WorkflowDefinition:
    post = community_store.get_post(post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Community post not found")

    forked = WorkflowDefinition.model_validate(
        post.workflow.model_dump(by_alias=True)
    )
    forked.id = _new_workflow_id()
    base_name = post.title.strip() or forked.name or "Untitled"
    forked.name = f"{base_name} (fork)"
    forked.created_at = None
    forked.updated_at = None

    saved = workflow_store.save_workflow(forked)
    community_store.increment_fork_count(post_id)
    return saved


@app.delete("/community/{post_id}")
async def delete_community_post(
    post_id: str,
    payload: DeleteCommunityRequest,
) -> dict[str, bool]:
    try:
        deleted = community_store.delete_post(post_id, payload.delete_token)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Community post not found")
    return {"deleted": True}
