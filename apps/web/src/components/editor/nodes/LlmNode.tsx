"use client";

import { Handle, type Node, type NodeProps } from "@xyflow/react";

import { Position } from "@/lib/flow";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type LlmNodeType = Node<WorkflowNodeData, "llm">;

export function LlmNode({ data, selected }: NodeProps<LlmNodeType>) {
  return (
    <div
      className={`box-border w-full max-w-full overflow-hidden p-3 text-left ${
        selected ? "ring-2 ring-violet-400" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} />
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-400">
        LLM
      </div>
      <div className="truncate text-sm font-medium">{data.label}</div>
      <div className="mt-2 space-y-1 overflow-hidden text-xs text-muted">
        <p className="truncate">Model: {data.model || "gemma4:e4b"}</p>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
