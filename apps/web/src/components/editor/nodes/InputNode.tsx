"use client";

import { type MouseEvent } from "react";
import { Handle, type Node, type NodeProps } from "@xyflow/react";

import { SpinnerIcon } from "@/components/ui/SpinnerIcon";
import { NodeCardLabel } from "@/components/editor/nodes/NodeCardLabel";
import { useWorkflowExecution } from "@/hooks/useWorkflowExecution";
import { formatAttachmentSummary } from "@/lib/attachments";
import { getNodeTypeLabel } from "@/lib/node-labels";
import { Position } from "@/lib/flow";
import { useWorkflowStore } from "@/stores/workflowStore";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type InputNodeType = Node<WorkflowNodeData, "input">;

export function InputNode({ id, data }: NodeProps<InputNodeType>) {
  const { run, stop, isRunning } = useWorkflowExecution();
  const runningStartNodeId = useWorkflowStore((state) => state.runningStartNodeId);
  const isThisRunning = isRunning && runningStartNodeId === id;
  const attachmentSummary = formatAttachmentSummary(data.attachments);
  const preview = data.value || attachmentSummary || "Enter prompt in property panel";
  const canRun =
    Boolean(data.value?.trim()) || Boolean(data.attachments?.length);

  const handleRunClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (isThisRunning) {
      stop();
      return;
    }
    if (isRunning) {
      return;
    }
    void run(id);
  };

  return (
    <div className="box-border w-full max-w-full overflow-hidden p-3 text-left">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">
          {getNodeTypeLabel("input")}
        </div>
        <button
          type="button"
          onClick={handleRunClick}
          disabled={isThisRunning ? false : isRunning || !canRun}
          title={
            isThisRunning
              ? "Stop"
              : isRunning
                ? "Another Start Point is running"
                : "Run"
          }
          aria-label={isThisRunning ? "Stop" : "Run"}
          className={`nodrag nopan group inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-sky-400/30 bg-sky-800/80 text-sky-50 transition hover:border-sky-300/40 hover:bg-sky-700/90 disabled:cursor-not-allowed disabled:opacity-40 ${
            isThisRunning ? "hover:border-red-400/40 hover:bg-red-700/90" : ""
          }`}
        >
          {isThisRunning ? (
            <>
              <span className="group-hover:hidden">
                <SpinnerIcon size={12} className="text-sky-50" />
              </span>
              <span className="material-icons hidden text-[14px] leading-none group-hover:inline">
                stop
              </span>
            </>
          ) : (
            <span className="material-icons text-[14px] leading-none">play_arrow</span>
          )}
        </button>
      </div>
      <NodeCardLabel label={data.label} type="input" />
      <p className="mt-2 max-w-full overflow-hidden break-words text-xs text-muted [overflow-wrap:anywhere] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]">
        {preview}
      </p>
      {attachmentSummary && data.value && (
        <p className="mt-1 truncate text-[11px] text-sky-300/80">
          {attachmentSummary} attached
        </p>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
