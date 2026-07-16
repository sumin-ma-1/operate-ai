"use client";

import { Handle, type Node, type NodeProps } from "@xyflow/react";

import { Position } from "@/lib/flow";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type OutputNodeType = Node<WorkflowNodeData, "output">;

export function OutputNode({ data, selected }: NodeProps<OutputNodeType>) {
  return (
    <div className={`min-w-[220px] p-3 ${selected ? "ring-2 ring-primary" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
        Output
      </div>
      <div className="text-sm font-medium">{data.label}</div>
      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-muted">
        {data.result || "Run workflow to see output"}
      </p>
    </div>
  );
}
