export type WorkflowNodeType = "input" | "llm" | "output" | "loop";

export type WorkflowAttachmentKind = "text" | "image" | "document";

export interface WorkflowAttachment {
  id: string;
  name: string;
  mimeType: string;
  kind: WorkflowAttachmentKind;
  content: string;
}

export interface WorkflowNodePosition {
  x: number;
  y: number;
}

export interface WorkflowNodeStyle {
  width?: number;
  height?: number;
}

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  value?: string;
  attachments?: WorkflowAttachment[];
  model?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  result?: string;
  /** Loop container: natural-language stop condition */
  goalPrompt?: string;
  /** Loop container: safety cap (default 5) */
  maxIterations?: number;
  /** Loop container: optional model for built-in checker */
  checkerModel?: string;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: WorkflowNodePosition;
  data: WorkflowNodeData;
  parentId?: string;
  style?: WorkflowNodeStyle;
  extent?: "parent";
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  disabled?: boolean;
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
  createdAt?: string;
  updatedAt?: string;
}
