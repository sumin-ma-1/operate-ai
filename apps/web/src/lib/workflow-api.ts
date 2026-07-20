import type {
  ExecuteWorkflowRequest,
  ExecuteWorkflowResponse,
  OllamaModel,
  WorkflowDefinition,
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

export async function fetchModels(): Promise<OllamaModel[]> {
  const data = await request<{ models: OllamaModel[] }>("/models");
  return data.models;
}
