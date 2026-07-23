"use client";

import { Handle, type Node, type NodeProps } from "@xyflow/react";

import { getNodeTypeLabel } from "@/lib/node-labels";
import { Position } from "@/lib/flow";

import { NodeCardLabel } from "@/components/editor/nodes/NodeCardLabel";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type ApprovalNodeType = Node<WorkflowNodeData, "approval">;

export function ApprovalNode({ data }: NodeProps<ApprovalNodeType>) {
  return (
    <div className="box-border w-full max-w-full overflow-hidden p-3 text-left">
      <Handle type="target" position={Position.Left} />
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-400">
        {getNodeTypeLabel("approval")}
      </div>
      <NodeCardLabel label={data.label} type="approval" />
      <p className="mt-2 max-w-full overflow-hidden break-words text-xs text-muted [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3]">
        {data.approvalPrompt?.trim() || "Review before continuing"}
      </p>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
