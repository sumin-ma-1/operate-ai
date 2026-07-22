"use client";

import { Handle, type Node, type NodeProps } from "@xyflow/react";

import { Position } from "@/lib/flow";

import { formatAttachmentSummary } from "@/lib/attachments";

import type { WorkflowNodeData } from "@operate-ai/workflow-schema";

type InputNodeType = Node<WorkflowNodeData, "input">;

export function InputNode({ data }: NodeProps<InputNodeType>) {
  const attachmentSummary = formatAttachmentSummary(data.attachments);
  const preview = data.value || attachmentSummary || "Enter text in property panel";

  return (
    <div className="box-border w-full max-w-full overflow-hidden p-3 text-left">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-400">
        Input
      </div>
      <div className="truncate text-sm font-medium">{data.label}</div>
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
