"use client";

import type { WorkflowNodeType } from "@operate-ai/workflow-schema";

export type ExecutionNodeStatus = "pending" | "running" | "completed" | "failed";

export interface ExecutionProgressNode {
  nodeId: string;
  nodeType: WorkflowNodeType;
  label: string;
  status: ExecutionNodeStatus;
  message?: string;
}

interface ExecutionProgressProps {
  items: ExecutionProgressNode[];
}

function typeClass(nodeType: WorkflowNodeType) {
  switch (nodeType) {
    case "input":
      return "text-sky-400";
    case "llm":
      return "text-violet-400";
    case "output":
      return "text-emerald-400";
  }
}

function dotClass(status: ExecutionNodeStatus) {
  switch (status) {
    case "running":
      return "border-sky-400 bg-sky-400/30";
    case "completed":
      return "border-emerald-400 bg-emerald-400/30";
    case "failed":
      return "border-red-400 bg-red-400/30";
    default:
      return "border-border bg-background";
  }
}

function labelClass(status: ExecutionNodeStatus) {
  switch (status) {
    case "running":
      return "text-foreground";
    case "completed":
      return "text-muted";
    case "failed":
      return "text-red-300";
    default:
      return "text-muted/60";
  }
}

function typeLabel(nodeType: WorkflowNodeType) {
  switch (nodeType) {
    case "input":
      return "Input";
    case "llm":
      return "LLM";
    case "output":
      return "Output";
  }
}

function connectorClass(status: ExecutionNodeStatus) {
  switch (status) {
    case "completed":
      return "border-solid border-emerald-400/55";
    case "failed":
      return "border-solid border-red-400/55";
    default:
      return "border-dashed border-border/70";
  }
}

function statusIcon(status: ExecutionNodeStatus) {
  switch (status) {
    case "running":
      return "autorenew";
    case "completed":
      return "check_circle";
    case "failed":
      return "error_outline";
    default:
      return "radio_button_unchecked";
  }
}

function statusIconClass(status: ExecutionNodeStatus) {
  switch (status) {
    case "running":
      return "text-sky-400";
    case "completed":
      return "text-emerald-400";
    case "failed":
      return "text-red-300";
    default:
      return "text-muted/50";
  }
}

export function ExecutionProgress({ items }: ExecutionProgressProps) {
  return (
    <div className="py-1">
      {items.map((item, index) => (
        <div key={item.nodeId}>
          <div className="relative pl-6">
            <span className="absolute left-0 top-1 flex h-4 w-4 items-center justify-center">
              {item.status === "pending" ? (
                <span
                  className={`h-[11px] w-[11px] rounded-full border-2 ${dotClass(item.status)}`}
                  aria-hidden="true"
                />
              ) : (
                <span
                  className={`material-icons text-[16px] leading-none ${statusIconClass(item.status)} ${
                    item.status === "running" ? "animate-spin" : ""
                  }`}
                  aria-hidden="true"
                >
                  {statusIcon(item.status)}
                </span>
              )}
            </span>

            <div>
              <p className="text-sm leading-snug">
                <span
                  className={`font-semibold uppercase tracking-wide ${typeClass(item.nodeType)}`}
                >
                  {typeLabel(item.nodeType)}
                </span>
                <span className={`ml-1.5 ${labelClass(item.status)}`}>
                  {item.label}
                </span>
              </p>
              {item.status === "running" && item.message && (
                <p className="mt-1 text-xs text-muted">{item.message}</p>
              )}
            </div>
          </div>

          {index < items.length - 1 && (
            <div
              className={`ml-[6px] h-6 border-l ${connectorClass(item.status)}`}
              aria-hidden="true"
            />
          )}
        </div>
      ))}
    </div>
  );
}
