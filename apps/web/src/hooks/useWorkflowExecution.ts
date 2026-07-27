"use client";

import { useCallback } from "react";

import type { WorkflowNodeType } from "@operate-ai/workflow-schema";

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
  const setPendingApproval = useWorkflowStore((state) => state.setPendingApproval);

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
      setPendingApproval(null);
      setRunning(true, startNodeId);
      setExecutionPanelOpen(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const orderedNodes = getExecutionOrder(
        nodes.map((node) => ({
          id: node.id,
          type: node.type as WorkflowNodeType,
          label: node.data.label,
          parentId: node.parentId,
        })),
        edges.map((edge) => ({
          source: edge.source,
          target: edge.target,
          disabled: Boolean(edge.data?.disabled),
        })),
        startNodeId
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
          { workflow, input: inputValue, startNodeId },
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
              if (event.loopId) {
                updateExecutionProgress(event.loopId, {
                  status: "running",
                  message: event.message,
                  iteration: event.iteration,
                });
                return;
              }

              const current = useWorkflowStore.getState().executionProgress;
              setExecutionProgress(
                current.map((item) => {
                  if (item.nodeId === event.nodeId) {
                    return { ...item, status: "running", message: event.message };
                  }
                  if (
                    item.status === "running" &&
                    item.nodeType !== "loop"
                  ) {
                    return { ...item, status: "pending", message: undefined };
                  }
                  return item;
                })
              );
              return;
            }

            if (event.type === "approval_required") {
              setPendingApproval({
                runId: event.runId,
                nodeId: event.nodeId,
                label: event.label,
                content: event.content,
                prompt: event.prompt,
              });
              updateExecutionProgress(event.nodeId, {
                status: "awaiting_approval",
                message: event.prompt || "Waiting for approval",
              });
              return;
            }

            if (
              event.type === "tool_started" ||
              event.type === "tool_completed" ||
              event.type === "tool_round"
            ) {
              const targetId = event.loopId || event.nodeId;
              updateExecutionProgress(targetId, {
                status: "running",
                message: event.message,
                ...(event.iteration != null ? { iteration: event.iteration } : {}),
              });
              return;
            }

            if (event.type === "node_completed") {
              if (event.loopId) {
                updateExecutionProgress(event.loopId, {
                  status: "running",
                  message: event.iteration
                    ? `Iteration ${event.iteration} completed inner step`
                    : undefined,
                  iteration: event.iteration,
                });
                return;
              }

              if (
                useWorkflowStore.getState().pendingApproval?.nodeId === event.nodeId
              ) {
                setPendingApproval(null);
              }

              updateExecutionProgress(event.nodeId, {
                status: "completed",
                message: undefined,
                iteration: undefined,
                maxIterations: undefined,
              });
              return;
            }

            if (event.type === "loop_started") {
              updateExecutionProgress(event.nodeId, {
                status: "running",
                message: event.message,
                maxIterations: event.maxIterations,
                iteration: 1,
              });
              return;
            }

            if (event.type === "loop_iteration") {
              updateExecutionProgress(event.nodeId, {
                status: "running",
                message: event.message,
                iteration: event.iteration,
                maxIterations: event.maxIterations,
              });
              return;
            }

            if (event.type === "loop_completed") {
              updateExecutionProgress(event.nodeId, {
                status: "completed",
                message: `${event.reason} (${event.iterations}/${event.maxIterations})`,
                iteration: event.iterations,
                maxIterations: event.maxIterations,
              });
              return;
            }

            if (event.type === "node_failed") {
              setPendingApproval(null);
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
        setPendingApproval(null);
        if (isAbortError(err)) {
          return;
        }
        setExecutionError(err instanceof Error ? err.message : "Execution failed");
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setRunning(false);
        setPendingApproval(null);
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
      setPendingApproval,
      setRunning,
      stop,
      toWorkflowDefinition,
      updateExecutionProgress,
    ]
  );

  return { run, stop, isRunning };
}
