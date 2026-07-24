"use client";

import { useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";

import type { WorkflowNodeType } from "@operate-ai/workflow-schema";

import { workflowDefinitionToClipboard } from "@/lib/clipboard-selection";
import { NODE_TYPE_LABELS } from "@/lib/node-labels";
import {
  listStarred,
  unstarWorkflow,
  type StarredWorkflow,
} from "@/lib/workflow-stars";
import { useWorkflowStore } from "@/stores/workflowStore";

export const PALETTE_DRAG_MIME = "application/operate-ai-node";

const paletteItems: {
  kind: "node" | "loop-draw";
  type?: WorkflowNodeType;
  label: string;
  description: string;
}[] = [
  {
    kind: "node",
    type: "input",
    label: NODE_TYPE_LABELS.input,
    description: "Prompt",
  },
  {
    kind: "node",
    type: "llm",
    label: NODE_TYPE_LABELS.llm,
    description: "Model call",
  },
  {
    kind: "node",
    type: "output",
    label: NODE_TYPE_LABELS.output,
    description: "Final result",
  },
  {
    kind: "node",
    type: "approval",
    label: NODE_TYPE_LABELS.approval,
    description: "Review before continue",
  },
  {
    kind: "loop-draw",
    label: NODE_TYPE_LABELS.loop,
    description: "Draw on canvas",
  },
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
  approval: {
    container:
      "border-rose-400 bg-rose-500/55 hover:border-rose-300 hover:bg-rose-500/70",
    badge: "border-rose-300 bg-rose-600 text-rose-50",
  },
  loop: {
    container:
      "border-amber-400 bg-amber-500/55 hover:border-amber-300 hover:bg-amber-500/70",
    badge: "border-amber-300 bg-amber-600 text-amber-50",
  },
};

export function AddNodeFab() {
  const addNode = useWorkflowStore((state) => state.addNode);
  const startLoopDrawMode = useWorkflowStore((state) => state.startLoopDrawMode);
  const insertClipboard = useWorkflowStore((state) => state.insertClipboard);
  const loopDrawMode = useWorkflowStore((state) => state.loopDrawMode);
  const [open, setOpen] = useState(false);
  const [starred, setStarred] = useState<StarredWorkflow[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const refreshStarred = () => {
    setStarred(listStarred());
  };

  useEffect(() => {
    if (!open) return;
    refreshStarred();

    const handlePointerDown = (event: MouseEvent) => {
      if (draggingRef.current) return;
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "operate-ai:workflow-stars") {
        refreshStarred();
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("storage", handleStorage);
    };
  }, [open]);

  const dragGhostRef = useRef<HTMLElement | null>(null);

  const onPaletteDragStart = (
    event: DragEvent<HTMLButtonElement>,
    type: WorkflowNodeType
  ) => {
    draggingRef.current = true;
    event.dataTransfer.setData(PALETTE_DRAG_MIME, type);
    event.dataTransfer.effectAllowed = "move";

    const chip = event.currentTarget.querySelector<HTMLElement>("[data-palette-chip]");
    if (!chip) return;

    const ghost = chip.cloneNode(true) as HTMLElement;
    ghost.removeAttribute("data-palette-chip");
    ghost.style.position = "fixed";
    ghost.style.top = "-9999px";
    ghost.style.left = "-9999px";
    ghost.style.margin = "0";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "9999";
    document.body.appendChild(ghost);
    dragGhostRef.current = ghost;

    const { width, height } = chip.getBoundingClientRect();
    event.dataTransfer.setDragImage(ghost, width / 2, height / 2);
  };

  const onPaletteDragEnd = () => {
    draggingRef.current = false;
    dragGhostRef.current?.remove();
    dragGhostRef.current = null;
  };

  const handleInsertStarred = (item: StarredWorkflow) => {
    const clipboard = workflowDefinitionToClipboard(item.workflow);
    insertClipboard(clipboard);
    setOpen(false);
  };

  const handleUnstar = (event: MouseEvent, id: string) => {
    event.stopPropagation();
    unstarWorkflow(id);
    refreshStarred();
  };

  return (
    <div ref={rootRef} className="pointer-events-none absolute top-4 left-4 z-20">
      <div className="pointer-events-auto relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-sky-400/40 bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-800 text-white shadow-[0_8px_24px_rgba(14,165,233,0.28)] transition duration-300 hover:from-sky-500 hover:via-sky-600 hover:to-indigo-700 hover:shadow-[0_10px_28px_rgba(14,165,233,0.38)] ${
            open || loopDrawMode ? "rotate-45" : "animate-float"
          }`}
          title={open ? "Close nodes" : "Add node"}
          aria-label={open ? "Close nodes" : "Add node"}
          aria-expanded={open}
        >
          <span className="material-icons text-[24px] leading-none">add</span>
        </button>

        {open && (
          <div className="absolute top-0 left-14 max-h-[min(70vh,520px)] w-64 overflow-y-auto rounded-2xl border border-border bg-card/95 p-3 shadow-xl backdrop-blur-sm scrollbar-none">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Add node
            </p>
            <div className="flex flex-col gap-2">
              {paletteItems.map((item) => {
                const styles =
                  item.kind === "loop-draw"
                    ? chipStyles.loop
                    : chipStyles[item.type!];
                const isNode = item.kind === "node" && item.type;

                return (
                  <button
                    key={item.label}
                    type="button"
                    draggable={Boolean(isNode)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition ${styles.container} ${
                      isNode ? "cursor-grab active:cursor-grabbing" : ""
                    }`}
                    onDragStart={
                      isNode
                        ? (event) => onPaletteDragStart(event, item.type!)
                        : undefined
                    }
                    onDragEnd={isNode ? onPaletteDragEnd : undefined}
                    onClick={() => {
                      if (item.kind === "loop-draw") {
                        startLoopDrawMode();
                        setOpen(false);
                      } else if (item.type) {
                        addNode(item.type);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        data-palette-chip
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

            <div className="mt-3 border-t border-border/60 pt-3">
              <p className="mb-2 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <span className="material-icons text-[14px] leading-none text-amber-300">
                  star
                </span>
                Starred
              </p>
              {starred.length === 0 ? (
                <p className="px-1 text-[11px] leading-relaxed text-muted">
                  Star a workflow in Open Space to see it here. Click to paste
                  into this canvas.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {starred.map((item) => (
                    <div key={item.id} className="group relative">
                      <button
                        type="button"
                        className="w-full rounded-md border border-white/15 bg-transparent px-3 py-2 pr-8 text-left transition hover:border-white/30 hover:bg-white/5"
                        onClick={() => handleInsertStarred(item)}
                        title="Insert into canvas"
                      >
                        <div className="flex items-center gap-2">
                          <span className="inline-flex max-w-[55%] shrink-0 truncate rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-foreground/90">
                            {item.title}
                          </span>
                          <span className="truncate text-xs text-muted">
                            {item.workflow.nodes.length} nodes
                            {item.authorName ? ` · ${item.authorName}` : ""}
                          </span>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="absolute right-1.5 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:bg-black/55"
                        title="Unstar"
                        aria-label={`Unstar ${item.title}`}
                        onClick={(event) => handleUnstar(event, item.id)}
                      >
                        <span className="material-icons text-[14px] leading-none">
                          close
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
