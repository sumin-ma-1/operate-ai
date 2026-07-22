"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { ExecutionProgress } from "@/components/editor/ExecutionProgress";
import { OutputActions } from "@/components/editor/OutputActions";
import { ScrollFade } from "@/components/ui/ScrollFade";
import { SpinnerIcon } from "@/components/ui/SpinnerIcon";
import { getExecutionMessage, getExecutionOrder } from "@/lib/execution-order";
import { executeWorkflowStream } from "@/lib/workflow-api";
import { useWorkflowStore } from "@/stores/workflowStore";

function isAbortError(err: unknown) {
  return err instanceof Error && err.name === "AbortError";
}

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
  const abortRef = useRef<AbortController | null>(null);

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

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleRun = async () => {
    if (isRunning) {
      handleStop();
      return;
    }

    setError(null);
    clearExecutionProgress();
    setRunning(true);
    setOpen(true);

    const controller = new AbortController();
    abortRef.current = controller;

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
        },
        controller.signal
      );

      applyExecutionResults(result);
      clearExecutionProgress();

      if (!result.success && result.error) {
        setError(result.error);
      }
    } catch (err) {
      clearExecutionProgress();
      if (isAbortError(err)) {
        return;
      }
      setError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setRunning(false);
    }
  };

  const showPanel = open && Boolean(error || isRunning || lastResult);

  return (
    <div className="relative h-full min-h-0">
      <div className="relative h-full w-full">{children}</div>

      <div className="pointer-events-none absolute top-4 right-3 bottom-3 z-30 flex flex-col items-end">
        <div className="pointer-events-auto flex max-h-full min-h-0 flex-col items-end">
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={!isRunning && nodes.length === 0}
            title={isRunning ? "Stop" : "Run"}
            aria-label={isRunning ? "Stop" : "Run"}
            className={`group inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-800 text-white shadow-[0_2px_12px_rgba(59,130,246,0.28)] transition hover:border-blue-500/30 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 ${
              isRunning
                ? "hover:border-red-400/40 hover:bg-red-700/90"
                : showPanel
                  ? ""
                  : "animate-float"
            }`}
          >
            {isRunning ? (
              <>
                <span className="group-hover:hidden">
                  <SpinnerIcon size={20} className="text-white" />
                </span>
                <span className="material-icons hidden text-[22px] leading-none group-hover:inline">
                  stop
                </span>
              </>
            ) : (
              <span className="material-icons text-[22px] leading-none">
                play_arrow
              </span>
            )}
          </button>

          {showPanel && (
            <aside className="mt-3 flex w-[32rem] max-h-[calc(100%-3.5rem)] min-h-0 flex-col overflow-hidden rounded-2xl border border-sky-400/15 bg-slate-950/88 shadow-xl backdrop-blur-md">
              <ScrollFade className="space-y-5 p-5">
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
                      <section>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-300/90">
                            Final Output
                          </h4>
                          <OutputActions
                            content={lastResult.finalOutput || ""}
                            filename={workflowName || "output"}
                          />
                        </div>
                        <pre className="mt-3 overflow-auto rounded-lg border border-border/60 bg-background/80 p-3 text-base whitespace-pre-wrap scrollbar-none">
                          {lastResult.finalOutput || "(empty)"}
                        </pre>
                      </section>

                      <section>
                        <button
                          type="button"
                          onClick={() => setLogsOpen((current) => !current)}
                          className="flex w-full items-center gap-1.5 px-1 text-left"
                          aria-expanded={logsOpen}
                        >
                          <span className="material-icons text-[16px] leading-none text-muted">
                            {logsOpen ? "expand_less" : "expand_more"}
                          </span>
                          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                            Node Logs
                          </h4>
                        </button>
                        {logsOpen && (
                          <div className="mt-3 space-y-2">
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
                                  <pre className="mt-1 overflow-auto whitespace-pre-wrap text-sm text-muted scrollbar-none">
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
              </ScrollFade>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
