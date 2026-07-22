"use client";

import { useEffect, useRef, useState } from "react";

import type { WorkflowNodeType } from "@operate-ai/workflow-schema";

import { useWorkflowStore } from "@/stores/workflowStore";

const paletteItems: {
  type: WorkflowNodeType;
  label: string;
  description: string;
}[] = [
  { type: "input", label: "Input", description: "Text and file attachments" },
  { type: "llm", label: "LLM", description: "Model call" },
  { type: "output", label: "Output", description: "Display final result" },
];

const chipStyles: Record<
  WorkflowNodeType,
  { container: string; badge: string }
> = {
  input: {
    container:
      "border-sky-400 bg-sky-500/55 hover:border-sky-300 hover:bg-sky-500/70",
    badge: "border-sky-300 bg-sky-600 text-sky-50",
  },
  llm: {
    container:
      "border-violet-400 bg-violet-500/55 hover:border-violet-300 hover:bg-violet-500/70",
    badge: "border-violet-300 bg-violet-600 text-violet-50",
  },
  output: {
    container:
      "border-emerald-400 bg-emerald-500/55 hover:border-emerald-300 hover:bg-emerald-500/70",
    badge: "border-emerald-300 bg-emerald-600 text-emerald-50",
  },
};

export function AddNodeFab() {
  const addNode = useWorkflowStore((state) => state.addNode);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="pointer-events-none absolute top-4 left-4 z-20">
      <div className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-sky-400/50 bg-sky-500/90 text-white shadow-[0_8px_24px_rgba(14,165,233,0.35)] transition duration-300 hover:bg-sky-400 hover:shadow-[0_10px_28px_rgba(14,165,233,0.45)] ${
            open ? "rotate-45" : "animate-float"
          }`}
          title={open ? "Close nodes" : "Add node"}
          aria-label={open ? "Close nodes" : "Add node"}
          aria-expanded={open}
        >
          <span className="material-icons text-[24px] leading-none">add</span>
        </button>

        {open && (
          <div className="absolute top-0 left-14 w-64 rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-sm">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Add node
            </p>
            <div className="flex flex-col gap-2">
              {paletteItems.map((item) => {
                const styles = chipStyles[item.type];

                return (
                  <button
                    key={item.type}
                    type="button"
                    className={`w-full rounded-md border px-3 py-2 text-left transition ${styles.container}`}
                    onClick={() => {
                      addNode(item.type);
                      setOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles.badge}`}
                      >
                        {item.label}
                      </span>
                      <span className="truncate text-xs text-muted">
                        {item.description}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
