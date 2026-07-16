import type {
  ExecuteWorkflowRequest,
  ExecuteWorkflowResponse,
  OllamaModel,
  WorkflowDefinition,
  WorkflowSummary,
} from "@operate-ai/workflow-schema";

import { getApiUrl } from "./api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Request failed: ${response.status}`);
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
