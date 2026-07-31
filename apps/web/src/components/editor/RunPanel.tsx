"use client";

import { useState } from "react";

import { ExecutionProgress } from "@/components/editor/ExecutionProgress";
import { NodeLogsList } from "@/components/editor/NodeLogsList";
import { ResizeHandle } from "@/components/editor/ResizeHandle";
import { OutputActions } from "@/components/editor/OutputActions";
import { ResultImageGrid } from "@/components/editor/ResultImageGrid";
import { Button } from "@/components/ui/Button";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { getExecutionMessage, getExecutionOrder } from "@/lib/execution-order";
import { getFinalOutputHeading } from "@/lib/node-labels";
import { getFinalOutputImages } from "@/lib/result-images";
import { executeWorkflowStream } from "@/lib/workflow-api";
import { useWorkflowStore } from "@/stores/workflowStore";

export function RunPanel() {
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const lastResult = useWorkflowStore((state) => state.lastResult);
  const executionProgress = useWorkflowStore((state) => state.executionProgress);
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const toWorkflowDefinition = useWorkflowStore((state) => state.toWorkflowDefinition);
  const setRunning = useWorkflowStore((state) => state.setRunning);
  const setExecutionProgress = useWorkflowStore((state) => state.setExecutionProgress);
  const updateExecutionProgress = useWorkflowStore(
    (state) => state.updateExecutionProgress
  );
  const clearExecutionProgress = useWorkflowStore(
    (state) => state.clearExecutionProgress
  );
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
  const finalImages = lastResult
    ? getFinalOutputImages(lastResult.nodeResults)
    : [];

  const handleRun = async () => {
    setError(null);
    clearExecutionProgress();
    setRunning(true);

    const orderedNodes = getExecutionOrder(
      nodes.map((node) => ({
        id: node.id,
        type: node.type as "input" | "llm" | "output",
        label: node.data.label,
      })),
      edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        disabled: Boolean(edge.data?.disabled),
      }))
    );

    const firstNode = orderedNodes[0];
    setExecutionProgress(
      orderedNodes.map((node) => ({
        nodeId: node.id,
        nodeType: node.type,
        label: node.label,
        status: node.id === firstNode?.id ? "running" : "pending",
        message:
          node.id === firstNode?.id
            ? getExecutionMessage(
                node.type,
                nodes.find((item) => item.id === node.id)?.data.model,
                nodes.find((item) => item.id === node.id)?.data.provider
              )
            : undefined,
      }))
    );

    try {
      const workflow = toWorkflowDefinition();
      const result = await executeWorkflowStream(
        { workflow, input: inputValue },
        (event) => {
          if (event.type === "started") {
            setExecutionProgress(
              event.nodes.map((node, index) => ({
                nodeId: node.nodeId,
                nodeType: node.nodeType,
                label: node.label,
                status: index === 0 ? "running" : "pending",
                message:
                  index === 0
                    ? getExecutionMessage(
                        node.nodeType,
                        nodes.find((item) => item.id === node.nodeId)?.data
                          .model,
                        nodes.find((item) => item.id === node.nodeId)?.data
                          .provider
                      )
                    : undefined,
              }))
            );
            return;
          }

          if (event.type === "node_started") {
            const current = useWorkflowStore.getState().executionProgress;
            setExecutionProgress(
              current.map((item) =>
                item.nodeId === event.nodeId
                  ? { ...item, status: "running", message: event.message }
                  : item.status === "running"
                    ? { ...item, status: "pending", message: undefined }
                    : item
              )
            );
            return;
          }

          if (event.type === "node_completed") {
            updateExecutionProgress(event.nodeId, {
              status: "completed",
              message: undefined,
            });
            return;
          }

          if (event.type === "node_failed") {
            updateExecutionProgress(event.nodeId, {
              status: "failed",
              message: event.error,
            });
          }
        }
      );

      applyExecutionResults(result);
      clearExecutionProgress();

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
          <Button
            onClick={handleRun}
            disabled={isRunning || nodes.length === 0}
            className="inline-flex shrink-0 items-center gap-1.5 !rounded-full px-4 py-1.0"
          >
            <span
              className={`material-icons text-[18px] leading-none ${
                isRunning ? "animate-spin" : ""
              }`}
            >
              {isRunning ? "autorenew" : "play_arrow"}
            </span>
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

        {isRunning && executionProgress.length > 0 && (
          <ExecutionProgress items={executionProgress} />
        )}

        {lastResult ? (
          <>
            <div className="shrink-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold uppercase text-muted">
                  {getFinalOutputHeading({
                    nodeResults: lastResult.nodeResults,
                    nodes,
                  })}
                </h4>
                <OutputActions
                  content={lastResult.finalOutput || ""}
                  filename={workflowName || "output"}
                />
              </div>
              <pre className="scrollbar-none mt-2 max-h-80 overflow-auto rounded-md border border-border bg-background p-3 text-sm whitespace-pre-wrap">
                {lastResult.finalOutput || "(empty)"}
              </pre>
              {finalImages.length > 0 ? (
                <ResultImageGrid
                  images={finalImages}
                  size="md"
                  className="mt-2"
                />
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <h4 className="shrink-0 text-xs font-semibold uppercase text-muted">
                Node Logs
              </h4>
              <div className="scrollbar-none mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
                <NodeLogsList results={lastResult.nodeResults} nodes={nodes} />
              </div>
            </div>
          </>
        ) : (
          !isRunning && (
            <p className="text-sm text-muted">
              Run the workflow to see output and logs here.
            </p>
          )
        )}
      </div>
    </aside>
  );
}
