"use client";

import { useCallback } from "react";

import { getExecutionMessage, getExecutionOrder } from "@/lib/execution-order";
import { executeWorkflowStream } from "@/lib/workflow-api";
import { useWorkflowStore } from "@/stores/workflowStore";

function isAbortError(err: unknown) {
  return err instanceof Error && err.name === "AbortError";
}

const abortRef: { current: AbortController | null } = { current: null };

export function useWorkflowExecution() {
  const isRunning = useWorkflowStore((state) => state.isRunning);
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const toWorkflowDefinition = useWorkflowStore((state) => state.toWorkflowDefinition);
  const setRunning = useWorkflowStore((state) => state.setRunning);
  const setExecutionProgress = useWorkflowStore((state) => state.setExecutionProgress);
  const updateExecutionProgress = useWorkflowStore(
    (state) => state.updateExecutionProgress
  );
  const clearExecutionProgress = useWorkflowStore(
    (state) => state.clearExecutionProgress
  );
  const applyExecutionResults = useWorkflowStore(
    (state) => state.applyExecutionResults
  );
  const setExecutionPanelOpen = useWorkflowStore(
    (state) => state.setExecutionPanelOpen
  );
  const setExecutionError = useWorkflowStore((state) => state.setExecutionError);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const run = useCallback(
    async (startNodeId: string) => {
      if (useWorkflowStore.getState().isRunning) {
        stop();
        return;
      }

      const startNode = nodes.find((node) => node.id === startNodeId);
      if (!startNode || startNode.type !== "input") {
        setExecutionError("Select a Start Point node to run.");
        setExecutionPanelOpen(true);
        return;
      }

      const inputValue = startNode.data.value || "";
      if (!inputValue.trim() && !(startNode.data.attachments?.length ?? 0)) {
        setExecutionError("Add text or attachments to the Start Point before running.");
        setExecutionPanelOpen(true);
        return;
      }

      setExecutionError(null);
      clearExecutionProgress();
      setRunning(true);
      setExecutionPanelOpen(true);

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
          setExecutionError(result.error);
        }
      } catch (err) {
        clearExecutionProgress();
        if (isAbortError(err)) {
          return;
        }
        setExecutionError(err instanceof Error ? err.message : "Execution failed");
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setRunning(false);
      }
    },
    [
      applyExecutionResults,
      clearExecutionProgress,
      edges,
      nodes,
      setExecutionError,
      setExecutionPanelOpen,
      setExecutionProgress,
      setRunning,
      stop,
      toWorkflowDefinition,
      updateExecutionProgress,
    ]
  );

  return { run, stop, isRunning };
}
