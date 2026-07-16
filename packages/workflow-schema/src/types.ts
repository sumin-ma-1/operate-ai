export type WorkflowNodeType = "input" | "llm" | "output";

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  value?: string;
  model?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  result?: string;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: WorkflowNodePosition;
  data: WorkflowNodeData;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ExecuteWorkflowRequest {
  workflow: WorkflowDefinition;
  input?: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  nodeType: WorkflowNodeType;
  output: string;
}

export interface ExecuteWorkflowResponse {
  success: boolean;
  nodeResults: NodeExecutionResult[];
  finalOutput: string;
  error?: string;
}

export interface OllamaModel {
  name: string;
  size?: number;
  modified_at?: string;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  updatedAt?: string;
}
