"use client";

import { Handle, type Node, type NodeProps } from "@xyflow/react";

import { Position } from "@/lib/flow";

import { NodeCardLabel } from "@/components/editor/nodes/NodeCardLabel";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type LlmNodeType = Node<WorkflowNodeData, "llm">;

export function LlmNode({ data }: NodeProps<LlmNodeType>) {
  return (
    <div className="box-border w-full max-w-full overflow-hidden p-3 text-left">
      <Handle type="target" position={Position.Left} />
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-400">
        LLM
      </div>
      <NodeCardLabel label={data.label} type="llm" />
      <div className="mt-2 space-y-1 overflow-hidden text-xs text-muted">
        <p className="truncate">Model: {data.model || "gemma4:e4b"}</p>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
