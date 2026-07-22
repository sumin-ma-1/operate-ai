import type { WorkflowNodeType } from "@operate-ai/workflow-schema";

import { getNodeDisplayLabel } from "@/lib/node-labels";

export function NodeCardLabel({
  label,
  type,
}: {
  label?: string;
  type: WorkflowNodeType;
}) {
  const { text, isPlaceholder } = getNodeDisplayLabel(label, type);

  return (
    <div
      className={`truncate text-sm ${
        isPlaceholder
          ? "font-normal uppercase tracking-wider text-muted/40"
          : "font-medium"
      }`}
    >
      {text}
    </div>
  );
}
