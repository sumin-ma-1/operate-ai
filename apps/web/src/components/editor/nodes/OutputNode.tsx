"use client";

import { Handle, type Node, type NodeProps } from "@xyflow/react";

import { END_POINT_EMPTY_PLACEHOLDER, getNodeTypeLabel } from "@/lib/node-labels";
import { Position } from "@/lib/flow";

import { NodeCardLabel } from "@/components/editor/nodes/NodeCardLabel";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type OutputNodeType = Node<WorkflowNodeData, "output">;

export function OutputNode({ data }: NodeProps<OutputNodeType>) {
  return (
    <div className="box-border w-full max-w-full overflow-hidden p-3 text-left">
      <Handle type="target" position={Position.Left} />
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
        {getNodeTypeLabel("output")}
      </div>
      <NodeCardLabel label={data.label} type="output" />
      <p className="mt-2 max-w-full overflow-hidden break-words text-xs text-muted [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]">
        {data.result || END_POINT_EMPTY_PLACEHOLDER}
      </p>
    </div>
  );
}
