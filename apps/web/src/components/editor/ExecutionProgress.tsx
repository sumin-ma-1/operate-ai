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

function statusClass(status: ExecutionNodeStatus) {
  switch (status) {
    case "running":
      return "text-sky-400";
    case "completed":
      return "text-emerald-400";
    case "failed":
      return "text-red-300";
    default:
      return "text-muted";
  }
}

export function ExecutionProgress({ items }: ExecutionProgressProps) {
  return (
    <div className="shrink-0 rounded-md border border-border bg-background p-3">
      <h4 className="text-xs font-semibold uppercase text-muted">Progress</h4>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.nodeId}
            className={`rounded-md border px-3 py-2 text-xs ${
              item.status === "running"
                ? "border-sky-400/40 bg-sky-500/10"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`material-icons mt-0.5 text-[16px] leading-none ${statusClass(item.status)} ${
                  item.status === "running" ? "animate-spin" : ""
                }`}
              >
                {statusIcon(item.status)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted">({item.nodeType.toUpperCase()})</span>
                </div>
                {item.message && (
                  <p className="mt-1 text-muted">{item.message}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
