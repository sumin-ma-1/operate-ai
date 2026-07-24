"use client";

import { useEffect, useState } from "react";

import { getNodeTypeLabel } from "@/lib/node-labels";
import type {
  LoopIterationLog,
  NodeExecutionResult,
  WorkflowNodeType,
} from "@operate-ai/workflow-schema";

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

function IterationBlock({ log }: { log: LoopIterationLog }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-border/50 bg-background/40">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs"
        aria-expanded={open}
      >
        <span className="material-icons text-[14px] leading-none text-muted">
          {open ? "expand_more" : "chevron_right"}
        </span>
        <span className="font-medium">Iteration {log.iteration}</span>
        <span className="text-muted">
          · {log.entries.length} node{log.entries.length === 1 ? "" : "s"}
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/40 px-2 py-2">
          {log.entries.map((entry) => {
            const entryLabel =
              entry.label?.trim() ||
              getNodeTypeLabel(entry.nodeType as WorkflowNodeType);
            return (
              <div key={`${log.iteration}-${entry.nodeId}`} className="space-y-1">
                <div className="text-[11px] font-medium text-foreground/80">
                  {entryLabel}
                  <span className="font-normal text-muted">
                    {" "}
                    ({getNodeTypeLabel(entry.nodeType as WorkflowNodeType)})
                  </span>
                </div>
                <pre className="overflow-auto whitespace-pre-wrap rounded bg-background/50 px-2 py-1.5 text-[11px] text-muted scrollbar-none">
                  {entry.output || "(empty)"}
                </pre>
              </div>
            );
          })}
          {log.checkerFeedback ? (
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-amber-700/90 dark:text-amber-300/90">
                Checker Feedback
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded bg-amber-500/5 px-2 py-1.5 text-[11px] text-muted scrollbar-none">
                {log.checkerFeedback}
              </pre>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
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
  const iterationLogs = result.iterationLogs ?? [];

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
        <div className="space-y-2 border-t border-border/40 px-2.5 py-2">
          <pre className="overflow-auto whitespace-pre-wrap text-xs text-muted scrollbar-none">
            {result.output || "(empty)"}
          </pre>
          {iterationLogs.length > 0 ? (
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted">
                Inside loop
              </div>
              {iterationLogs.map((log) => (
                <IterationBlock key={log.iteration} log={log} />
              ))}
            </div>
          ) : null}
        </div>
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
