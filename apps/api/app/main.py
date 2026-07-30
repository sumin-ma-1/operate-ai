from fastapi import Body, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import json

from app.config import (
    COMMUNITY_PUBLISH_RATE_LIMIT,
    COMMUNITY_PUBLISH_RATE_WINDOW_SECONDS,
    CORS_ORIGINS,
)
from app.schemas import (
    ApprovalDecisionRequest,
    CommunityPost,
    CommunityPostSummary,
    DeleteCommunityRequest,
    ExecuteWorkflowRequest,
    ExecuteWorkflowResponse,
    OllamaPullRequest,
    NodeProviderKeyUpdate,
    ProviderSettingsUpdate,
    ProviderTestRequest,
    PublishCommunityRequest,
    ForgeSettingsUpdate,
    WorkflowDefinition,
    WorkflowSummary,
)
from app.services.community_sanitize import strip_large_attachments
from app.services.community_store import CommunityStore
from app.services.executor import DAGExecutor
from app.services.forge_service import get_active_checkpoint, list_checkpoints
from app.services.forge_store import forge_store
from app.services.llm.factory import build_model_catalog
from app.services.ollama import OllamaService
from app.services.rate_limit import SlidingWindowRateLimiter
from app.services.run_registry import run_registry
from app.services.secrets_store import secrets_store
from app.services.workflow_store import WorkflowStore
from app.services.google_auth import get_current_google_user_id

app = FastAPI(title="Operate-AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        *CORS_ORIGINS,
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


@app.get("/models/catalog")
async def models_catalog() -> dict:
    catalog = await build_model_catalog(ollama_service)
    return {"providers": catalog}


@app.get("/settings/providers")
async def get_provider_settings() -> dict:
    return {"providers": secrets_store.public_view()}


@app.put("/settings/providers")
async def put_provider_settings(payload: ProviderSettingsUpdate) -> dict:
    updates = payload.model_dump(exclude_unset=True)
    view = secrets_store.update_keys(updates)
    return {"providers": view}


@app.post("/settings/providers/test")
async def test_provider(payload: ProviderTestRequest) -> dict:
    key = (payload.api_key or "").strip() or secrets_store.get_api_key(
        payload.provider, payload.node_id
    )
    try:
        if payload.provider == "openai":
            from app.services.llm.openai_client import OpenAIClient

            client = OpenAIClient(key)
            models = await client.list_models()
            await client.chat(
                model=models[0] if models else "gpt-4o-mini",
                user_message="Reply with OK",
            )
        elif payload.provider == "anthropic":
            from app.services.llm.anthropic_client import AnthropicClient

            client = AnthropicClient(key)
            await client.chat(
                model="claude-3-5-haiku-latest",
                user_message="Reply with OK",
            )
        else:
            from app.services.llm.gemini_client import GeminiClient

            client = GeminiClient(key)
            models = await client.list_models()
            await client.chat(
                model=models[0] if models else "gemini-2.0-flash",
                user_message="Reply with OK",
            )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"ok": True}


@app.get("/settings/providers/nodes/{node_id}")
async def get_node_provider_keys(node_id: str) -> dict:
    return {"providers": secrets_store.get_node_override_view(node_id)}


@app.put("/settings/providers/nodes/{node_id}")
async def put_node_provider_key(
    node_id: str, payload: NodeProviderKeyUpdate
) -> dict:
    view = secrets_store.set_node_override(
        node_id, payload.provider, payload.api_key
    )
    return {"providers": view}


@app.get("/forge/models")
async def forge_models() -> dict:
    try:
        checkpoints = await list_checkpoints()
        active = await get_active_checkpoint()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {
        "checkpoints": checkpoints,
        "activeCheckpoint": active,
        "defaultCheckpoint": forge_store.get_default_checkpoint(),
    }


@app.get("/settings/forge")
async def get_forge_settings() -> dict:
    try:
        active = await get_active_checkpoint()
    except ValueError:
        active = ""
    return {
        "defaultCheckpoint": forge_store.get_default_checkpoint(),
        "activeCheckpoint": active,
    }


@app.put("/settings/forge")
async def put_forge_settings(payload: ForgeSettingsUpdate) -> dict:
    view = forge_store.set_default_checkpoint(payload.default_checkpoint)
    try:
        active = await get_active_checkpoint()
    except ValueError:
        active = ""
    return {**view, "activeCheckpoint": active}


@app.post("/ollama/pull")
async def ollama_pull(payload: OllamaPullRequest) -> StreamingResponse:
    async def event_generator():
        try:
            async for status in ollama_service.pull_model_stream(payload.name.strip()):
                yield f"data: {json.dumps(status)}\n\n"
            yield f"data: {json.dumps({'done': True, 'status': 'success'})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc), 'done': True})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.delete("/ollama/models/{model_name:path}")
async def ollama_delete_model(model_name: str) -> dict[str, bool]:
    try:
        await ollama_service.delete_model(model_name)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"deleted": True}


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
    user_id: str = Depends(get_current_google_user_id),
) -> CommunityPost:
    if not publish_rate_limiter.allow(_client_key(request)):
        raise HTTPException(
            status_code=429,
            detail="Publish rate limit exceeded. Try again later.",
        )

    snapshot = strip_large_attachments(payload.workflow)
    return community_store.publish(
        author_user_id=user_id,
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
    payload: DeleteCommunityRequest | None = Body(default=None),
    user_id: str = Depends(get_current_google_user_id),
) -> dict[str, bool]:
    try:
        deleted = community_store.delete_post(
            post_id,
            author_user_id=user_id,
            delete_token=payload.delete_token if payload else None,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if not deleted:
        raise HTTPException(status_code=404, detail="Community post not found")
    return {"deleted": True}
