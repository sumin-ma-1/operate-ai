"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { ExecutionProgress } from "@/components/editor/ExecutionProgress";
import { OutputActions } from "@/components/editor/OutputActions";
import { ScrollFade } from "@/components/ui/ScrollFade";
import { useResizableHeight } from "@/hooks/useResizableHeight";
import { getNodeTypeLabel } from "@/lib/node-labels";
import { useWorkflowStore } from "@/stores/workflowStore";

const RESIZE_HANDLE_HEIGHT = 10;

function PanelBody({
  executionError,
  isRunning,
  executionProgress,
  lastResult,
  logsOpen,
  setLogsOpen,
  nodes,
  workflowName,
}: {
  executionError: string | null;
  isRunning: boolean;
  executionProgress: ReturnType<
    typeof useWorkflowStore.getState
  >["executionProgress"];
  lastResult: ReturnType<typeof useWorkflowStore.getState>["lastResult"];
  logsOpen: boolean;
  setLogsOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  nodes: ReturnType<typeof useWorkflowStore.getState>["nodes"];
  workflowName: string;
}) {
  return (
    <div className="space-y-4">
      {executionError && (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
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
              <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">
                Final Output
              </h4>
              <OutputActions
                content={lastResult.finalOutput || ""}
                filename={workflowName || "output"}
              />
            </div>
            <pre className="mt-2 overflow-auto rounded-lg border border-border/60 bg-background/80 p-3 text-sm whitespace-pre-wrap scrollbar-none">
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
              <div className="mt-2 space-y-2">
                {lastResult.nodeResults.map((result) => {
                  const label =
                    nodes.find((node) => node.id === result.nodeId)?.data.label ||
                    result.nodeType;
                  const typeLabel = getNodeTypeLabel(result.nodeType);
                  const typeAccent =
                    result.nodeType === "input"
                      ? "border-sky-400/30"
                      : result.nodeType === "llm"
                        ? "border-violet-400/30"
                        : result.nodeType === "loop"
                          ? "border-amber-400/30"
                          : "border-emerald-400/30";

                  return (
                    <div
                      key={result.nodeId}
                      className={`rounded-lg border bg-background/60 p-2.5 text-sm ${typeAccent}`}
                    >
                      <span className="font-medium">{label}</span>
                      <span className="text-muted"> ({typeLabel})</span>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap text-xs text-muted scrollbar-none">
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
  );
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const userResizedRef = useRef(false);
  const { height, setHeight, onResizeStart, maxHeight } = useResizableHeight({
    defaultHeight: 160,
    minHeight: 96,
    containerRef,
    topReserve: 40,
    storageKey: "execution-panel-height",
    userResizedRef,
  });

  useEffect(() => {
    if (isRunning) {
      userResizedRef.current = false;
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

  const isPanelFull = height >= maxHeight - 8;

  useLayoutEffect(() => {
    if (!showPanel || userResizedRef.current) return;

    const content = contentRef.current;
    if (!content) return;

    const fitToContent = () => {
      const nextHeight = Math.min(
        maxHeight,
        Math.max(96, content.scrollHeight + RESIZE_HANDLE_HEIGHT)
      );
      setHeight(nextHeight);
    };

    fitToContent();

    const observer = new ResizeObserver(fitToContent);
    observer.observe(content);
    return () => observer.disconnect();
  }, [
    showPanel,
    maxHeight,
    setHeight,
    executionError,
    executionProgress,
    isRunning,
    lastResult,
    logsOpen,
    isPanelFull,
  ]);

  const panelOffsetStyle = {
    "--execution-panel-height": showPanel ? `${height}px` : "0px",
  } as CSSProperties;

  const panelBody = (
    <PanelBody
      executionError={executionError}
      isRunning={isRunning}
      executionProgress={executionProgress}
      lastResult={lastResult}
      logsOpen={logsOpen}
      setLogsOpen={setLogsOpen}
      nodes={nodes}
      workflowName={workflowName}
    />
  );

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-0"
      style={panelOffsetStyle}
    >
      <div className="relative h-full w-full">{children}</div>

      {showPanel && (
        <aside
          className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex w-full flex-col overflow-hidden border-t border-sky-400/15 bg-slate-950/92 shadow-[0_-8px_32px_rgba(15,23,42,0.45)] backdrop-blur-md"
          style={{ height }}
        >
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize execution panel"
            onPointerDown={onResizeStart}
            className="group flex h-2.5 shrink-0 cursor-row-resize items-center justify-center border-b border-border/40 touch-none"
          >
            <span className="h-0.5 w-10 rounded-full bg-border/80 transition group-hover:bg-sky-400/50 group-active:bg-sky-400/70" />
          </div>

          <div
            ref={contentRef}
            className={`p-4 ${isPanelFull ? "min-h-0 flex-1 overflow-hidden" : ""}`}
          >
            {isPanelFull ? (
              <ScrollFade className="space-y-4">{panelBody}</ScrollFade>
            ) : (
              panelBody
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
