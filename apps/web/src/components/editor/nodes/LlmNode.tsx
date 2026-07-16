"use client";

import { Handle, type Node, type NodeProps } from "@xyflow/react";

import { Position } from "@/lib/flow";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type LlmNodeType = Node<WorkflowNodeData, "llm">;

export function LlmNode({ data, selected }: NodeProps<LlmNodeType>) {
  return (
    <div className={`min-w-[220px] p-3 ${selected ? "ring-2 ring-primary" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-400">
        LLM
      </div>
      <div className="text-sm font-medium">{data.label}</div>
      <div className="mt-2 space-y-1 text-xs text-muted">
        <p>Model: {data.model || "llama3"}</p>
        <p className="line-clamp-2">
          Prompt: {data.userPromptTemplate || "{{input}}"}
        </p>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
