"use client";

import { useEffect, useState } from "react";

import { getNodeTypeLabel } from "@/lib/node-labels";
import type { NodeExecutionResult, WorkflowNodeType } from "@operate-ai/workflow-schema";

type LogNode = {
  id: string;
  data: { label?: string };
};

function typeAccent(nodeType: string) {
  switch (nodeType) {
    case "input":
      return "border-sky-400/30";
    case "llm":
      return "border-violet-400/30";
    case "loop":
      return "border-amber-400/30";
    case "approval":
      return "border-rose-400/30";
    default:
      return "border-emerald-400/30";
  }
}

function NodeLogEntry({
  result,
  label,
}: {
  result: NodeExecutionResult;
  label: string;
}) {
  const isLoop = result.nodeType === "loop";
  const [open, setOpen] = useState(!isLoop);
  const typeLabel = getNodeTypeLabel(result.nodeType as WorkflowNodeType);

  useEffect(() => {
    setOpen(!isLoop);
  }, [result.nodeId, result.output, isLoop]);

  return (
    <div
      className={`rounded-lg border bg-background/60 text-sm ${typeAccent(result.nodeType)}`}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-left"
        aria-expanded={open}
      >
        <span className="material-icons text-[16px] leading-none text-muted">
          {open ? "expand_more" : "chevron_right"}
        </span>
        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium">{label}</span>
          <span className="text-muted"> ({typeLabel})</span>
        </span>
      </button>
      {open && (
        <pre className="overflow-auto whitespace-pre-wrap border-t border-border/40 px-2.5 py-2 text-xs text-muted scrollbar-none">
          {result.output || "(empty)"}
        </pre>
      )}
    </div>
  );
}

export function NodeLogsList({
  results,
  nodes,
}: {
  results: NodeExecutionResult[];
  nodes: LogNode[];
}) {
  return (
    <div className="space-y-2">
      {results.map((result) => {
        const label =
          nodes.find((node) => node.id === result.nodeId)?.data.label?.trim() ||
          getNodeTypeLabel(result.nodeType as WorkflowNodeType);

        return (
          <NodeLogEntry key={result.nodeId} result={result} label={label} />
        );
      })}
    </div>
  );
}
