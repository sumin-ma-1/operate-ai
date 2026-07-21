"use client";

import { useEffect, useState, type ReactNode } from "react";

import { ExecutionProgress } from "@/components/editor/ExecutionProgress";
import { OutputActions } from "@/components/editor/OutputActions";
import { Button } from "@/components/ui/Button";
import { getExecutionMessage, getExecutionOrder } from "@/lib/execution-order";
import { executeWorkflowStream } from "@/lib/workflow-api";
import { useWorkflowStore } from "@/stores/workflowStore";

export function ExecutionFab({ children }: { children: ReactNode }) {
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

  const [open, setOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputNode = nodes.find((node) => node.type === "input");
  const inputValue = inputNode?.data.value || "";

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (isRunning) {
      setOpen(true);
    }
  }, [isRunning]);

  const handleRun = async () => {
    setError(null);
    clearExecutionProgress();
    setRunning(true);
    setOpen(true);

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
                nodes.find((item) => item.id === node.id)?.data.model
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
                        nodes.find((item) => item.id === node.nodeId)?.data.model
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

  const handleFabClick = () => {
    setOpen((current) => !current);
  };

  return (
    <div className="relative h-full min-h-0">
      <div className="relative h-full w-full">{children}</div>

      <div className="pointer-events-none absolute top-4 right-3 bottom-3 z-30 flex flex-col items-end">
        <div className="pointer-events-auto flex max-h-full min-h-0 flex-col items-end">
          <button
            type="button"
            onClick={handleFabClick}
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-200/50 bg-amber-500/90 text-amber-50 shadow-[0_10px_28px_rgba(217,169,56,0.3)] transition duration-300 hover:border-amber-100/60 hover:bg-amber-400/95 hover:shadow-[0_10px_30px_rgba(234,179,8,0.38)] ${
              isRunning ? "" : open ? "" : "animate-float"
            }`}
            title={open ? "Close execution" : "Execution"}
            aria-label={open ? "Close execution" : "Execution"}
            aria-expanded={open}
          >
            <span
              className={`material-icons text-[24px] leading-none ${
                isRunning ? "animate-spin" : ""
              }`}
            >
              {isRunning ? "autorenew" : "auto_fix_high"}
            </span>
          </button>

          {open && (
            <aside className="mt-3 flex h-fit w-[32rem] max-h-[calc(100%-3.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-xl backdrop-blur-sm">
              <div className="shrink-0 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">Execution</p>
                    <p className="mt-0.5 text-sm text-muted">
                      Run workflow against Ollama
                    </p>
                  </div>
                  <Button
                    onClick={handleRun}
                    disabled={isRunning || nodes.length === 0}
                    className="inline-flex shrink-0 items-center gap-1.5 !rounded-full !border !border-blue-500/20 !bg-blue-800 px-4 py-1.5 text-sm shadow-[0_2px_10px_rgba(59,130,246,0.2)] hover:!border-blue-500/30 hover:!bg-blue-700 hover:!opacity-100"
                  >
                    <span
                      className={`material-icons text-[20px] leading-none ${
                        isRunning ? "animate-spin" : ""
                      }`}
                    >
                      {isRunning ? "autorenew" : "play_arrow"}
                    </span>
                    {isRunning ? "Running" : "Run"}
                  </Button>
                </div>
              </div>

              {(error || isRunning || lastResult) && (
                <div className="scrollbar-soft min-h-0 space-y-5 overflow-y-auto px-5 pb-5">
                  {error && (
                    <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-base text-red-300">
                      {error}
                    </p>
                  )}

                  {isRunning && executionProgress.length > 0 && (
                    <ExecutionProgress items={executionProgress} />
                  )}

                  {lastResult && (
                    <>
                      <section className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-300/90">
                            Final Output
                          </h4>
                          <OutputActions
                            content={lastResult.finalOutput || ""}
                            filename={workflowName || "output"}
                          />
                        </div>
                        <pre className="scrollbar-soft mt-3 overflow-auto rounded-lg border border-border/60 bg-background/80 p-3 text-base whitespace-pre-wrap">
                          {lastResult.finalOutput || "(empty)"}
                        </pre>
                      </section>

                      <section>
                        <button
                          type="button"
                          onClick={() => setLogsOpen((current) => !current)}
                          className="flex w-full items-center gap-2 text-left"
                          aria-expanded={logsOpen}
                        >
                          <span className="material-icons text-[20px] leading-none text-muted">
                            {logsOpen ? "expand_less" : "expand_more"}
                          </span>
                          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">
                            Node Logs
                          </h4>
                        </button>
                        {logsOpen && (
                          <div className="scrollbar-soft mt-3 space-y-2 pr-1">
                            {lastResult.nodeResults.map((result) => {
                              const label =
                                nodes.find((node) => node.id === result.nodeId)?.data
                                  .label || result.nodeType;
                              const typeLabel = result.nodeType.toUpperCase();
                              const typeAccent =
                                result.nodeType === "input"
                                  ? "border-sky-400/30"
                                  : result.nodeType === "llm"
                                    ? "border-violet-400/30"
                                    : "border-emerald-400/30";

                              return (
                                <div
                                  key={result.nodeId}
                                  className={`rounded-lg border bg-background/60 p-2.5 text-sm ${typeAccent}`}
                                >
                                  <span className="font-medium">{label}</span>
                                  <span className="text-muted"> ({typeLabel})</span>
                                  <pre className="scrollbar-soft mt-1 overflow-auto whitespace-pre-wrap text-sm text-muted">
                                    {result.output || "(empty)"}
                                  </pre>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    </>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
