"use client";

import type { WorkflowNodeType } from "@operate-ai/workflow-schema";

import { PropertyPanel } from "@/components/editor/PropertyPanel";
import { ResizeHandle } from "@/components/editor/ResizeHandle";
import { Button } from "@/components/ui/Button";
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
          {paletteItems.map((item) => (
            <Button
              key={item.type}
              variant="secondary"
              className="flex flex-col items-start gap-1 text-left"
              onClick={() => addNode(item.type)}
            >
              <span>{item.label}</span>
              <span className="text-xs font-normal text-muted">
                {item.description}
              </span>
            </Button>
          ))}
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
