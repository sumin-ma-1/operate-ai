from typing import Literal, Optional

from pydantic import BaseModel, Field


class WorkflowNodePosition(BaseModel):
    x: float
    y: float


class WorkflowAttachment(BaseModel):
    id: str
    name: str
    mime_type: str = Field(alias="mimeType")
    kind: Literal["text", "image", "document"]
    content: str

    model_config = {"populate_by_name": True}


class WorkflowNodeStyle(BaseModel):
    width: Optional[float] = None
    height: Optional[float] = None


class WorkflowNodeData(BaseModel):
    label: str
    value: Optional[str] = None
    attachments: Optional[list[WorkflowAttachment]] = None
    model: Optional[str] = "gemma4:e4b"
    provider: Optional[Literal["ollama", "openai", "anthropic", "gemini"]] = "ollama"
    system_prompt: Optional[str] = Field(default=None, alias="systemPrompt")
    user_prompt_template: Optional[str] = Field(
        default="{{input}}", alias="userPromptTemplate"
    )
    result: Optional[str] = None
    goal_prompt: Optional[str] = Field(default=None, alias="goalPrompt")
    max_iterations: Optional[int] = Field(default=5, alias="maxIterations")
    checker_model: Optional[str] = Field(default=None, alias="checkerModel")
    checker_provider: Optional[
        Literal["ollama", "openai", "anthropic", "gemini"]
    ] = Field(default=None, alias="checkerProvider")
    approval_prompt: Optional[str] = Field(default=None, alias="approvalPrompt")
    enabled_tools: Optional[list[str]] = Field(default=None, alias="enabledTools")
    max_tool_rounds: Optional[int] = Field(default=5, alias="maxToolRounds")
    forge_checkpoint: Optional[str] = Field(default=None, alias="forgeCheckpoint")

    model_config = {"populate_by_name": True}


class WorkflowNode(BaseModel):
    id: str
    type: Literal["input", "llm", "output", "loop", "approval"]
    position: WorkflowNodePosition
    data: WorkflowNodeData
    parent_id: Optional[str] = Field(default=None, alias="parentId")
    style: Optional[WorkflowNodeStyle] = None
    extent: Optional[Literal["parent"]] = None

    model_config = {"populate_by_name": True}


class WorkflowEdge(BaseModel):
    id: str
    source: str
    target: str
    source_handle: Optional[str] = Field(default=None, alias="sourceHandle")
    target_handle: Optional[str] = Field(default=None, alias="targetHandle")
    disabled: Optional[bool] = False

    model_config = {"populate_by_name": True}


class WorkflowDefinition(BaseModel):
    id: str
    name: str
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]
    created_at: Optional[str] = Field(default=None, alias="createdAt")
    updated_at: Optional[str] = Field(default=None, alias="updatedAt")

    model_config = {"populate_by_name": True}


class ExecuteWorkflowRequest(BaseModel):
    workflow: WorkflowDefinition
    input: Optional[str] = None
    start_node_id: Optional[str] = Field(default=None, alias="startNodeId")
    run_id: Optional[str] = Field(default=None, alias="runId")

    model_config = {"populate_by_name": True}


class ApprovalDecisionRequest(BaseModel):
    run_id: str = Field(alias="runId")
    action: Literal["approve", "edit", "cancel"]
    edited_content: Optional[str] = Field(default=None, alias="editedContent")

    model_config = {"populate_by_name": True}


class LoopIterationLogEntry(BaseModel):
    node_id: str = Field(alias="nodeId")
    node_type: str = Field(alias="nodeType")
    label: Optional[str] = None
    output: str

    model_config = {"populate_by_name": True}


class LoopIterationLog(BaseModel):
    iteration: int
    entries: list[LoopIterationLogEntry]
    checker_feedback: Optional[str] = Field(default=None, alias="checkerFeedback")

    model_config = {"populate_by_name": True}


class NodeExecutionResult(BaseModel):
    node_id: str = Field(alias="nodeId")
    node_type: str = Field(alias="nodeType")
    output: str
    iteration_logs: Optional[list[LoopIterationLog]] = Field(
        default=None, alias="iterationLogs"
    )

    model_config = {"populate_by_name": True}


class ExecuteWorkflowResponse(BaseModel):
    success: bool
    node_results: list[NodeExecutionResult] = Field(alias="nodeResults")
    final_output: str = Field(alias="finalOutput")
    error: Optional[str] = None

    model_config = {"populate_by_name": True}


class WorkflowSummary(BaseModel):
    id: str
    name: str
    created_at: Optional[str] = Field(default=None, alias="createdAt")
    updated_at: Optional[str] = Field(default=None, alias="updatedAt")

    model_config = {"populate_by_name": True}


class CommunityPostSummary(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    author_name: str = Field(alias="authorName")
    tags: list[str] = Field(default_factory=list)
    fork_count: int = Field(alias="forkCount")
    node_count: int = Field(alias="nodeCount")
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")

    model_config = {"populate_by_name": True}


class CommunityPost(CommunityPostSummary):
    workflow: WorkflowDefinition
    delete_token: Optional[str] = Field(default=None, alias="deleteToken")

    model_config = {"populate_by_name": True}


class PublishCommunityRequest(BaseModel):
    author_name: str = Field(alias="authorName", min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=2000)
    tags: Optional[list[str]] = Field(default=None, max_length=8)
    workflow: WorkflowDefinition

    model_config = {"populate_by_name": True}


class DeleteCommunityRequest(BaseModel):
    delete_token: Optional[str] = Field(alias="deleteToken", default=None, min_length=1)

    model_config = {"populate_by_name": True}


class ProviderSettingsUpdate(BaseModel):
    """Omit a provider to leave unchanged; empty string clears the key."""

    openai: Optional[str] = None
    anthropic: Optional[str] = None
    gemini: Optional[str] = None


class OllamaPullRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class ProviderTestRequest(BaseModel):
    provider: Literal["openai", "anthropic", "gemini"]
    api_key: Optional[str] = Field(default=None, alias="apiKey")
    node_id: Optional[str] = Field(default=None, alias="nodeId")

    model_config = {"populate_by_name": True}


class NodeProviderKeyUpdate(BaseModel):
    provider: Literal["openai", "anthropic", "gemini"]
    api_key: Optional[str] = Field(default=None, alias="apiKey")

    model_config = {"populate_by_name": True}


class ForgeSettingsUpdate(BaseModel):
    default_checkpoint: Optional[str] = Field(default=None, alias="defaultCheckpoint")

    model_config = {"populate_by_name": True}
