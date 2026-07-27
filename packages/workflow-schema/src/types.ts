export type WorkflowNodeType =
  | "input"
  | "llm"
  | "output"
  | "loop"
  | "approval";

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

export type LLMProvider = "ollama" | "openai" | "anthropic" | "gemini";

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  value?: string;
  attachments?: WorkflowAttachment[];
  model?: string;
  /** LLM backend; defaults to ollama */
  provider?: LLMProvider;
  systemPrompt?: string;
  userPromptTemplate?: string;
  result?: string;
  /** Loop container: natural-language stop condition */
  goalPrompt?: string;
  /** Loop container: safety cap (default 5) */
  maxIterations?: number;
  /** Loop container: optional model for built-in checker */
  checkerModel?: string;
  /** Loop container: provider for checker (default ollama) */
  checkerProvider?: LLMProvider;
  /** Approval node: optional reviewer instructions shown while waiting */
  approvalPrompt?: string;
  /** LLM node: enabled tool names (e.g. web_search, generate_image, run_python) */
  enabledTools?: string[];
  /** LLM node: max tool-call rounds per run (default 5) */
  maxToolRounds?: number;
  /** LLM node: Forge checkpoint override for generate_image */
  forgeCheckpoint?: string;
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
  /** When set, only this Start Point and nodes reachable from it are executed. */
  startNodeId?: string;
  runId?: string;
}

export type ApprovalDecisionAction = "approve" | "edit" | "cancel";

export interface ApprovalDecisionRequest {
  runId: string;
  action: ApprovalDecisionAction;
  editedContent?: string;
}

export interface LoopIterationLogEntry {
  nodeId: string;
  nodeType: WorkflowNodeType;
  label?: string;
  output: string;
}

export interface LoopIterationLog {
  iteration: number;
  entries: LoopIterationLogEntry[];
  /** Present when this iteration ended with CONTINUE */
  checkerFeedback?: string;
}

export interface NodeExecutionResult {
  nodeId: string;
  nodeType: WorkflowNodeType;
  output: string;
  /** Agent loop: per-iteration inner node outputs */
  iterationLogs?: LoopIterationLog[];
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

export interface ModelCatalogProvider {
  provider: LLMProvider;
  label: string;
  configured: boolean;
  supportsTools: boolean;
  models: string[];
}

export interface ProviderSecretStatus {
  configured: boolean;
  apiKeyMasked: string;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommunityPostSummary {
  id: string;
  title: string;
  description?: string;
  authorName: string;
  tags: string[];
  forkCount: number;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunityPost extends CommunityPostSummary {
  workflow: WorkflowDefinition;
  /** Returned only on publish; store locally to delete the post later */
  deleteToken?: string;
}

export interface PublishCommunityRequest {
  authorName: string;
  title: string;
  description?: string;
  tags?: string[];
  workflow: WorkflowDefinition;
}

export interface DeleteCommunityRequest {
  deleteToken: string;
}
