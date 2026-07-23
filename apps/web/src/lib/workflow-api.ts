import type {
  ApprovalDecisionRequest,
  ExecuteWorkflowRequest,
  ExecuteWorkflowResponse,
  OllamaModel,
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
      loopId?: string;
      iteration?: number;
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
