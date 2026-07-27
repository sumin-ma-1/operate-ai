import type {
  ApprovalDecisionRequest,
  CommunityPost,
  CommunityPostSummary,
  ExecuteWorkflowRequest,
  ExecuteWorkflowResponse,
  LoopIterationLog,
  ModelCatalogProvider,
  OllamaModel,
  ProviderSecretStatus,
  PublishCommunityRequest,
  WorkflowDefinition,
  WorkflowNodeType,
  WorkflowSummary,
} from "@operate-ai/workflow-schema";

import { getApiUrl } from "./api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = getApiUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Network error";
    throw new Error(
      `Failed to reach API at ${url}. Is the API running on port 8000? (${reason})`
    );
  }

  if (!response.ok) {
    const error = await response.text();
    let message = error || `Request failed: ${response.status}`;
    try {
      const parsed = JSON.parse(error) as {
        detail?: string | Array<{ msg?: string }>;
      };
      if (typeof parsed.detail === "string") {
        message = parsed.detail;
      } else if (Array.isArray(parsed.detail)) {
        const messages = parsed.detail
          .map((item) => item.msg)
          .filter(Boolean)
          .join("; ");
        if (messages) {
          message = messages;
        }
      }
    } catch {
      // keep raw error text
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function fetchWorkflows(): Promise<WorkflowSummary[]> {
  return request<WorkflowSummary[]>("/workflows");
}

export async function fetchWorkflow(id: string): Promise<WorkflowDefinition> {
  return request<WorkflowDefinition>(`/workflows/${id}`);
}

export async function saveWorkflow(
  workflow: WorkflowDefinition
): Promise<WorkflowDefinition> {
  return request<WorkflowDefinition>("/workflows", {
    method: "POST",
    body: JSON.stringify(workflow),
  });
}

export async function deleteWorkflow(id: string): Promise<void> {
  await request(`/workflows/${id}`, { method: "DELETE" });
}

export async function executeWorkflow(
  payload: ExecuteWorkflowRequest
): Promise<ExecuteWorkflowResponse> {
  return request<ExecuteWorkflowResponse>("/execute", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitApprovalDecision(
  payload: ApprovalDecisionRequest
): Promise<void> {
  await request("/execute/decision", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type ExecutionStreamEvent =
  | {
      type: "started";
      runId?: string;
      nodes: Array<{
        nodeId: string;
        nodeType: WorkflowNodeType;
        label: string;
      }>;
    }
  | {
      type: "node_started";
      nodeId: string;
      nodeType: WorkflowNodeType;
      label: string;
      message: string;
      loopId?: string;
      iteration?: number;
    }
  | {
      type: "node_completed";
      nodeId: string;
      nodeType: WorkflowNodeType;
      output: string;
      images?: string[];
      loopId?: string;
      iteration?: number;
      iterationLogs?: LoopIterationLog[];
    }
  | {
      type: "node_failed";
      nodeId: string;
      error: string;
    }
  | {
      type: "approval_required";
      runId: string;
      nodeId: string;
      nodeType: WorkflowNodeType;
      label: string;
      content: string;
      prompt: string;
    }
  | {
      type: "tool_started";
      nodeId: string;
      toolName: string;
      args?: Record<string, unknown>;
      message: string;
      loopId?: string;
      iteration?: number;
    }
  | {
      type: "tool_completed";
      nodeId: string;
      toolName: string;
      summary?: string;
      message: string;
      hasImage?: boolean;
      loopId?: string;
      iteration?: number;
    }
  | {
      type: "tool_round";
      nodeId: string;
      message: string;
      round: number;
      loopId?: string;
      iteration?: number;
    }
  | {
      type: "loop_started";
      nodeId: string;
      label: string;
      maxIterations: number;
      message: string;
    }
  | {
      type: "loop_iteration";
      nodeId: string;
      iteration: number;
      maxIterations: number;
      message: string;
    }
  | {
      type: "loop_completed";
      nodeId: string;
      iterations: number;
      maxIterations: number;
      reason: string;
      output: string;
      checkerFeedback?: string;
      iterationLogs?: LoopIterationLog[];
    }
  | ({
      type: "completed";
    } & ExecuteWorkflowResponse)
  | {
      type: "failed";
      error: string;
    }
  | {
      type: "cancelled";
      nodeId?: string;
      error: string;
    };

export async function executeWorkflowStream(
  payload: ExecuteWorkflowRequest,
  onEvent: (event: ExecutionStreamEvent) => void,
  signal?: AbortSignal
): Promise<ExecuteWorkflowResponse> {
  const url = getApiUrl("/execute/stream");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    const reason = err instanceof Error ? err.message : "Network error";
    throw new Error(
      `Failed to reach API at ${url}. Is the API running on port 8000? (${reason})`
    );
  }

  if (!response.ok || !response.body) {
    const error = await response.text();
    throw new Error(error || `Request failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: ExecuteWorkflowResponse | null = null;

  const onAbort = () => {
    void reader.cancel();
  };
  signal?.addEventListener("abort", onAbort);

  try {
    while (true) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const line = chunk
          .split("\n")
          .find((entry) => entry.startsWith("data: "));
        if (!line) continue;

        const event = JSON.parse(line.slice(6)) as ExecutionStreamEvent;
        onEvent(event);

        if (event.type === "completed") {
          finalResult = {
            success: event.success,
            nodeResults: event.nodeResults,
            finalOutput: event.finalOutput,
            error: event.error,
          };
        }

        if (event.type === "failed") {
          throw new Error(event.error);
        }

        if (event.type === "cancelled") {
          throw new Error(event.error || "Cancelled by user");
        }
      }
    }

    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    if (!finalResult) {
      throw new Error("Workflow execution ended unexpectedly");
    }

    return finalResult;
  } catch (err) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    throw err;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function fetchModels(): Promise<OllamaModel[]> {
  const data = await request<{ models: OllamaModel[] }>("/models");
  return data.models;
}

export async function fetchModelCatalog(): Promise<ModelCatalogProvider[]> {
  const data = await request<{ providers: ModelCatalogProvider[] }>(
    "/models/catalog"
  );
  return data.providers;
}

export async function fetchProviderSettings(): Promise<
  Record<string, ProviderSecretStatus>
> {
  const data = await request<{
    providers: Record<string, ProviderSecretStatus>;
  }>("/settings/providers");
  return data.providers;
}

export async function updateProviderSettings(payload: {
  openai?: string;
  anthropic?: string;
  gemini?: string;
}): Promise<Record<string, ProviderSecretStatus>> {
  const data = await request<{
    providers: Record<string, ProviderSecretStatus>;
  }>("/settings/providers", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return data.providers;
}

export interface ForgeCheckpoint {
  title: string;
  modelName: string;
}

export interface ForgeModelsResponse {
  checkpoints: ForgeCheckpoint[];
  activeCheckpoint: string;
  defaultCheckpoint: string;
}

export async function fetchForgeModels(): Promise<ForgeModelsResponse> {
  return request<ForgeModelsResponse>("/forge/models");
}

export async function fetchForgeSettings(): Promise<{
  defaultCheckpoint: string;
  activeCheckpoint: string;
}> {
  return request("/settings/forge");
}

export async function updateForgeSettings(payload: {
  defaultCheckpoint?: string;
}): Promise<{ defaultCheckpoint: string; activeCheckpoint: string }> {
  return request("/settings/forge", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function testProviderConnection(payload: {
  provider: "openai" | "anthropic" | "gemini";
  apiKey?: string;
  nodeId?: string;
}): Promise<void> {
  await request("/settings/providers/test", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchNodeProviderKeys(
  nodeId: string
): Promise<
  Record<
    string,
    ProviderSecretStatus & { usingGlobal?: boolean }
  >
> {
  const data = await request<{
    providers: Record<
      string,
      ProviderSecretStatus & { usingGlobal?: boolean }
    >;
  }>(`/settings/providers/nodes/${encodeURIComponent(nodeId)}`);
  return data.providers;
}

export async function updateNodeProviderKey(payload: {
  nodeId: string;
  provider: "openai" | "anthropic" | "gemini";
  apiKey?: string | null;
}): Promise<
  Record<string, ProviderSecretStatus & { usingGlobal?: boolean }>
> {
  const data = await request<{
    providers: Record<
      string,
      ProviderSecretStatus & { usingGlobal?: boolean }
    >;
  }>(`/settings/providers/nodes/${encodeURIComponent(payload.nodeId)}`, {
    method: "PUT",
    body: JSON.stringify({
      provider: payload.provider,
      apiKey: payload.apiKey ?? "",
    }),
  });
  return data.providers;
}

export async function pullOllamaModel(
  name: string,
  onStatus: (status: Record<string, unknown>) => void,
  signal?: AbortSignal
): Promise<void> {
  const url = getApiUrl("/ollama/pull");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
    signal,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Pull failed: ${response.status}`);
  }
  if (!response.body) {
    throw new Error("No response body from Ollama pull");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .map((part) => part.trim())
        .find((part) => part.startsWith("data:"));
      if (!line) continue;
      const raw = line.replace(/^data:\s*/, "");
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        onStatus(parsed);
        if (parsed.error) {
          throw new Error(String(parsed.error));
        }
      } catch (err) {
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }
  }
}

export async function deleteOllamaModel(name: string): Promise<void> {
  await request(`/ollama/models/${encodeURIComponent(name)}`, {
    method: "DELETE",
  });
}

export async function fetchCommunityPosts(params?: {
  q?: string;
  tag?: string;
  sort?: "newest" | "forks";
}): Promise<CommunityPostSummary[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.tag) search.set("tag", params.tag);
  if (params?.sort) search.set("sort", params.sort);
  const query = search.toString();
  return request<CommunityPostSummary[]>(
    `/community${query ? `?${query}` : ""}`
  );
}

export async function fetchCommunityPost(id: string): Promise<CommunityPost> {
  return request<CommunityPost>(`/community/${id}`);
}

export async function publishCommunityPost(
  payload: PublishCommunityRequest
): Promise<CommunityPost> {
  return request<CommunityPost>("/community", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function forkCommunityPost(
  id: string
): Promise<WorkflowDefinition> {
  return request<WorkflowDefinition>(`/community/${id}/fork`, {
    method: "POST",
  });
}

export async function deleteCommunityPost(
  id: string,
  deleteToken: string
): Promise<void> {
  await request(`/community/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ deleteToken }),
  });
}
