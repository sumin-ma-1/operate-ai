import type { WorkflowNodeType } from "@operate-ai/workflow-schema";

export const NODE_TYPE_LABELS: Record<WorkflowNodeType, string> = {
  input: "Start Point",
  llm: "LLM",
  output: "End Point",
  loop: "Agent Loop",
};

export const NODE_LABEL_PLACEHOLDER = "MAKE A LABEL";

export function getNodeTypeLabel(type: WorkflowNodeType): string {
  return NODE_TYPE_LABELS[type];
}

/** True when the user has not set a custom node label. */
export function isUnsetNodeLabel(
  label: string | undefined,
  type: WorkflowNodeType
): boolean {
  const trimmed = label?.trim() ?? "";
  if (!trimmed) return true;
  return trimmed === NODE_TYPE_LABELS[type];
}

export function getNodeDisplayLabel(
  label: string | undefined,
  type: WorkflowNodeType
): { text: string; isPlaceholder: boolean } {
  if (isUnsetNodeLabel(label, type)) {
    return { text: NODE_LABEL_PLACEHOLDER, isPlaceholder: true };
  }
  return { text: label!.trim(), isPlaceholder: false };
}

export const END_POINT_EMPTY_PLACEHOLDER =
  "Run from Start Point to see result";
