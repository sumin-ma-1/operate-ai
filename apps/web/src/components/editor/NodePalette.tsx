"use client";

import { PropertyPanel } from "@/components/editor/PropertyPanel";
import { ResizeHandle } from "@/components/editor/ResizeHandle";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { useWorkflowStore } from "@/stores/workflowStore";

export function NodePalette() {
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
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {hasSelection ? (
          <PropertyPanel />
        ) : (
          <div>
            <h2 className="text-sm font-semibold">Properties</h2>
            <p className="mt-2 text-sm text-muted">
              Select a node or connection to edit its properties. Use the +
              button on the canvas to add nodes.
            </p>
          </div>
        )}
      </div>

      <ResizeHandle side="right" onPointerDown={onResizeStart} />
    </aside>
  );
}
