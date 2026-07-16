"use client";

import { Handle, type Node, type NodeProps } from "@xyflow/react";

import { Position } from "@/lib/flow";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type InputNodeType = Node<WorkflowNodeData, "input">;

export function InputNode({ data, selected }: NodeProps<InputNodeType>) {
  return (
    <div className={`min-w-[200px] p-3 ${selected ? "ring-2 ring-primary" : ""}`}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-400">
        Input
      </div>
      <div className="text-sm font-medium">{data.label}</div>
      <p className="mt-2 line-clamp-3 text-xs text-muted">
        {data.value || "Enter text in property panel"}
      </p>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
