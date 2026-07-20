"use client";

import { useState } from "react";

import { ResizeHandle } from "@/components/editor/ResizeHandle";
import { OutputActions } from "@/components/editor/OutputActions";
import { Button } from "@/components/ui/Button";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { executeWorkflow } from "@/lib/workflow-api";
import { useWorkflowStore } from "@/stores/workflowStore";

export function RunPanel() {
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const lastResult = useWorkflowStore((state) => state.lastResult);
  const nodes = useWorkflowStore((state) => state.nodes);
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const toWorkflowDefinition = useWorkflowStore((state) => state.toWorkflowDefinition);
  const setRunning = useWorkflowStore((state) => state.setRunning);
  const applyExecutionResults = useWorkflowStore((state) => state.applyExecutionResults);
  const [error, setError] = useState<string | null>(null);
  const { width, onResizeStart } = useResizableWidth({
    defaultWidth: 320,
    minWidth: 240,
    maxWidth: 560,
    handleSide: "left",
    storageKey: "operate-ai-right-sidebar-width",
  });

  const inputNode = nodes.find((node) => node.type === "input");
  const inputValue = inputNode?.data.value || "";

  const handleRun = async () => {
    setError(null);
    setRunning(true);

    try {
      const workflow = toWorkflowDefinition();
      const result = await executeWorkflow({ workflow, input: inputValue });
      applyExecutionResults(result);

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <aside
      style={{ width }}
      className="relative flex shrink-0 flex-col border-l border-border bg-card"
    >
      <ResizeHandle side="left" onPointerDown={onResizeStart} />

      <div className="shrink-0 border-b border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Execution</h3>
            <p className="mt-1 text-xs text-muted">
              Run the connected workflow against Ollama.
            </p>
          </div>
          <Button onClick={handleRun} disabled={isRunning || nodes.length === 0}>
            {isRunning ? "Running" : "Run"}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
        {error && (
          <p className="shrink-0 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {lastResult ? (
          <>
            <div className="shrink-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase text-muted">
                  Final Output
                </h4>
                <OutputActions
                  content={lastResult.finalOutput || ""}
                  filename={`${workflowName || "output"}.txt`}
                />
              </div>
              <pre className="scrollbar-soft mt-2 max-h-80 overflow-auto rounded-md border border-border bg-background p-3 text-sm whitespace-pre-wrap">
                {lastResult.finalOutput || "(empty)"}
              </pre>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <h4 className="shrink-0 text-xs font-semibold uppercase text-muted">
                Node Logs
              </h4>
              <div className="scrollbar-soft mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {lastResult.nodeResults.map((result) => {
                  const label =
                    nodes.find((node) => node.id === result.nodeId)?.data.label ||
                    result.nodeType;
                  const typeLabel = result.nodeType.toUpperCase();

                  return (
                    <div
                      key={result.nodeId}
                      className="rounded-md border border-border bg-background p-2 text-xs"
                    >
                      <span className="font-medium">{label}</span>
                      <span className="text-muted"> ({typeLabel})</span>
                      <pre className="scrollbar-soft mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-muted">
                        {result.output || "(empty)"}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted">
            Run the workflow to see output and logs here.
          </p>
        )}
      </div>
    </aside>
  );
}
