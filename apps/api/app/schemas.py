from typing import Literal, Optional

from pydantic import BaseModel, Field


class WorkflowNodePosition(BaseModel):
    x: float
    y: float


class WorkflowNodeData(BaseModel):
    label: str
    value: Optional[str] = None
    model: Optional[str] = "gemma4:e4b"
    system_prompt: Optional[str] = Field(default=None, alias="systemPrompt")
    user_prompt_template: Optional[str] = Field(
        default="{{input}}", alias="userPromptTemplate"
    )
    result: Optional[str] = None

    model_config = {"populate_by_name": True}


class WorkflowNode(BaseModel):
    id: str
    type: Literal["input", "llm", "output"]
    position: WorkflowNodePosition
    data: WorkflowNodeData


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


class NodeExecutionResult(BaseModel):
    node_id: str = Field(alias="nodeId")
    node_type: str = Field(alias="nodeType")
    output: str

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
