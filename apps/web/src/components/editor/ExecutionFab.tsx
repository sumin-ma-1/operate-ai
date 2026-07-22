"use client";

import { useEffect, useState, type ReactNode } from "react";

import { ExecutionProgress } from "@/components/editor/ExecutionProgress";
import { OutputActions } from "@/components/editor/OutputActions";
import { ScrollFade } from "@/components/ui/ScrollFade";
import { getNodeTypeLabel } from "@/lib/node-labels";
import { useWorkflowStore } from "@/stores/workflowStore";

export function ExecutionFab({ children }: { children: ReactNode }) {
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const lastResult = useWorkflowStore((state) => state.lastResult);
  const executionError = useWorkflowStore((state) => state.executionError);
  const executionProgress = useWorkflowStore((state) => state.executionProgress);
  const executionPanelOpen = useWorkflowStore((state) => state.executionPanelOpen);
  const nodes = useWorkflowStore((state) => state.nodes);
  const workflowName = useWorkflowStore((state) => state.workflowName);
  const setExecutionPanelOpen = useWorkflowStore(
    (state) => state.setExecutionPanelOpen
  );

  const [logsOpen, setLogsOpen] = useState(false);

  useEffect(() => {
    if (isRunning) {
      setExecutionPanelOpen(true);
    }
  }, [isRunning, setExecutionPanelOpen]);

  useEffect(() => {
    if (!executionPanelOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExecutionPanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [executionPanelOpen, setExecutionPanelOpen]);

  const showPanel =
    executionPanelOpen && Boolean(executionError || isRunning || lastResult);

  return (
    <div className="relative h-full min-h-0">
      <div className="relative h-full w-full">{children}</div>

      {showPanel && (
        <div className="pointer-events-none absolute top-4 right-3 bottom-3 z-30 flex flex-col items-end">
          <aside className="pointer-events-auto flex w-[32rem] max-h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-sky-400/15 bg-slate-950/88 shadow-xl backdrop-blur-md">
            <ScrollFade className="space-y-5 p-5">
              {executionError && (
                <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-base text-red-300">
                  {executionError}
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
                          const typeLabel = getNodeTypeLabel(result.nodeType);
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
        </div>
      )}
    </div>
  );
}
