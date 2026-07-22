"use client";

import { Handle, type Node, type NodeProps } from "@xyflow/react";

import { Position } from "@/lib/flow";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type OutputNodeType = Node<WorkflowNodeData, "output">;

export function OutputNode({ data }: NodeProps<OutputNodeType>) {
  return (
    <div className="box-border w-full max-w-full overflow-hidden p-3 text-left">
      <Handle type="target" position={Position.Left} />
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
        Output
      </div>
      <div className="truncate text-sm font-medium">{data.label}</div>
      <p className="mt-2 max-w-full overflow-hidden break-words text-xs text-muted [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]">
        {data.result || "Run workflow to see output"}
      </p>
    </div>
  );
}
