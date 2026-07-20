"use client";

import { Handle, type Node, type NodeProps } from "@xyflow/react";

import { Position } from "@/lib/flow";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type InputNodeType = Node<WorkflowNodeData, "input">;

export function InputNode({ data, selected }: NodeProps<InputNodeType>) {
  return (
    <div
      className={`box-border w-full max-w-full overflow-hidden p-3 text-left ${
        selected ? "ring-2 ring-sky-400" : ""
      }`}
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-400">
        Input
      </div>
      <div className="truncate text-sm font-medium">{data.label}</div>
      <p className="mt-2 max-w-full overflow-hidden break-words text-xs text-muted [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]">
        {data.value || "Enter text in property panel"}
      </p>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
