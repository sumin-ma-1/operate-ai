"use client";

import type { WorkflowNodeType } from "@operate-ai/workflow-schema";

import { PropertyPanel } from "@/components/editor/PropertyPanel";
import { ResizeHandle } from "@/components/editor/ResizeHandle";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { useWorkflowStore } from "@/stores/workflowStore";

const paletteItems: {
  type: WorkflowNodeType;
  label: string;
  description: string;
}[] = [
  { type: "input", label: "Input", description: "Text and file attachments" },
  { type: "llm", label: "LLM", description: "Ollama model call" },
  { type: "output", label: "Output", description: "Display final result" },
];

const chipStyles: Record<
  WorkflowNodeType,
  { container: string; badge: string }
> = {
  input: {
    container:
      "border-sky-400/80 bg-sky-500/30 hover:border-sky-400 hover:bg-sky-500/40",
    badge: "border-sky-400 bg-sky-500/50 text-sky-100",
  },
  llm: {
    container:
      "border-violet-400/80 bg-violet-500/30 hover:border-violet-400 hover:bg-violet-500/40",
    badge: "border-violet-400 bg-violet-500/50 text-violet-100",
  },
  output: {
    container:
      "border-emerald-400/80 bg-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/40",
    badge: "border-emerald-400 bg-emerald-500/50 text-emerald-100",
  },
};

export function NodePalette() {
  const addNode = useWorkflowStore((state) => state.addNode);
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((state) => state.selectedEdgeId);
  const hasSelection = Boolean(selectedNodeId || selectedEdgeId);
  const { width, onResizeStart } = useResizableWidth({
    defaultWidth: 288,
    minWidth: 220,
    maxWidth: 480,
    handleSide: "right",
    storageKey: "operate-ai-left-sidebar-width",
  });

  return (
    <aside
      style={{ width }}
      className="relative flex shrink-0 flex-col border-r border-border bg-card"
    >
      <div className="shrink-0 border-b border-border p-4">
        <h2 className="text-sm font-semibold">Nodes</h2>
        <div className="mt-3 flex flex-col gap-2">
          {paletteItems.map((item) => {
            const styles = chipStyles[item.type];

            return (
              <button
                key={item.type}
                type="button"
                className={`w-full rounded-full border px-3 py-2 text-left transition ${styles.container}`}
                onClick={() => addNode(item.type)}
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

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {hasSelection ? (
          <PropertyPanel />
        ) : (
          <p className="text-sm text-muted">
            Select a node or connection to edit its properties.
          </p>
        )}
      </div>

      <ResizeHandle side="right" onPointerDown={onResizeStart} />
    </aside>
  );
}
