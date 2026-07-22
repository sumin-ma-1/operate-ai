"use client";

import { Handle, NodeResizer, type Node, type NodeProps } from "@xyflow/react";

import { NodeCardLabel } from "@/components/editor/nodes/NodeCardLabel";
import { Position } from "@/lib/flow";
import { NODE_TYPE_LABELS } from "@/lib/node-labels";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type LoopNodeType = Node<WorkflowNodeData, "loop">;

export function LoopNode({ data, selected }: NodeProps<LoopNodeType>) {
  const goal = data.goalPrompt?.trim();

  return (
    <>
      <NodeResizer
        minWidth={300}
        minHeight={180}
        isVisible={selected}
        lineClassName="!border-amber-400/50"
        handleClassName="!h-2 !w-2 !border-amber-400/60 !bg-amber-300/80"
      />
      <Handle type="target" position={Position.Left} className="!z-10" />
      <div className="pointer-events-none flex h-full min-h-[180px] w-full flex-col rounded-lg border border-dashed border-amber-400/35 bg-amber-500/[0.06] p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-amber-300/90">
          {NODE_TYPE_LABELS.loop}
        </div>
        <NodeCardLabel label={data.label} type="loop" />
        <p className="mt-2 line-clamp-2 text-xs text-muted">
          {goal || "Set a goal to know when this loop should stop."}
        </p>
        <p className="mt-auto text-[10px] uppercase tracking-wide text-muted/60">
          Max {data.maxIterations ?? 5} iterations
        </p>
      </div>
      <Handle type="source" position={Position.Right} className="!z-10" />
    </>
  );
}
