"use client";

import { useCallback, useEffect, useRef, type DragEvent } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { AddNodeFab, PALETTE_DRAG_MIME } from "@/components/editor/AddNodeFab";
import { ExecutionFab } from "@/components/editor/ExecutionFab";
import { LoopDrawOverlay } from "@/components/editor/LoopDrawOverlay";
import { MiniMapEdges } from "@/components/editor/MiniMapEdges";
import { NodeInspector } from "@/components/editor/NodeInspector";
import { nodeTypes } from "@/components/editor/nodes";
import type { WorkflowNodeType } from "@operate-ai/workflow-schema";
import { canBeTarget, isInnerNode } from "@/stores/workflowStore";
import { useWorkflowStore } from "@/stores/workflowStore";

const DROP_NODE_WIDTH = 220;
const DROP_NODE_HEIGHT = 96;
const CONNECT_CLICK_DELAY_MS = 220;

function isEditableHotkeyTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function WorkflowCanvas() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const selectedEdgeId = useWorkflowStore((state) => state.selectedEdgeId);
  const connectSourceId = useWorkflowStore((state) => state.connectSourceId);
  const loopDrawMode = useWorkflowStore((state) => state.loopDrawMode);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const selectEdge = useWorkflowStore((state) => state.selectEdge);
  const handleConnectNodeClick = useWorkflowStore(
    (state) => state.handleConnectNodeClick
  );
  const cancelConnect = useWorkflowStore((state) => state.cancelConnect);
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const clearCanvasSelection = useWorkflowStore(
    (state) => state.clearCanvasSelection
  );
  const selectAllNodes = useWorkflowStore((state) => state.selectAllNodes);
  const copySelection = useWorkflowStore((state) => state.copySelection);
  const pasteClipboard = useWorkflowStore((state) => state.pasteClipboard);
  const addNode = useWorkflowStore((state) => state.addNode);
  const reparentAfterDrag = useWorkflowStore((state) => state.reparentAfterDrag);
  const { screenToFlowPosition } = useReactFlow();
  const connectClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const clearConnectClickTimer = useCallback(() => {
    if (connectClickTimerRef.current == null) return;
    clearTimeout(connectClickTimerRef.current);
    connectClickTimerRef.current = null;
  }, []);

  useEffect(() => {
    return () => clearConnectClickTimer();
  }, [clearConnectClickTimer]);

  useEffect(() => {
    if (!connectSourceId) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        cancelConnect();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [connectSourceId, cancelConnect]);

  useEffect(() => {
    if (loopDrawMode) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableHotkeyTarget(event.target)) return;

      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;

      const key = event.key.toLowerCase();
      if (key === "c") {
        if (copySelection()) {
          event.preventDefault();
        }
        return;
      }
      if (key === "v") {
        if (pasteClipboard()) {
          event.preventDefault();
        }
        return;
      }
      if (key === "a") {
        event.preventDefault();
        clearConnectClickTimer();
        cancelConnect();
        selectAllNodes();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    loopDrawMode,
    copySelection,
    pasteClipboard,
    selectAllNodes,
    cancelConnect,
    clearConnectClickTimer,
  ]);

  const onDragOver = useCallback((event: DragEvent) => {
    if (!event.dataTransfer.types.includes(PALETTE_DRAG_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      if (loopDrawMode) return;

      const type = event.dataTransfer.getData(PALETTE_DRAG_MIME) as WorkflowNodeType;
      if (
        type !== "input" &&
        type !== "llm" &&
        type !== "output" &&
        type !== "approval"
      ) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode(type, {
        x: position.x - DROP_NODE_WIDTH / 2,
        y: position.y - DROP_NODE_HEIGHT / 2,
      });
    },
    [addNode, loopDrawMode, screenToFlowPosition]
  );

  const nodesWithSelection = nodes.map((node) => {
    const isConnectSource = node.id === connectSourceId;
    const nodeType = node.type as WorkflowNodeType;
    const connectSource = connectSourceId
      ? nodes.find((item) => item.id === connectSourceId)
      : null;
    const isValidTarget =
      Boolean(connectSourceId) &&
      node.id !== connectSourceId &&
      !isInnerNode(node) &&
      canBeTarget(nodeType);

    const isValidInnerTarget =
      Boolean(connectSourceId) &&
      node.id !== connectSourceId &&
      Boolean(connectSource?.parentId) &&
      node.parentId === connectSource?.parentId &&
      canBeTarget(nodeType);

    return {
      ...node,
      draggable: !loopDrawMode,
      selectable: !loopDrawMode,
      className: [
        node.className,
        isConnectSource ? "is-connect-source" : "",
        isValidTarget || isValidInnerTarget ? "is-connect-target" : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  });

  const edgesWithSelection = edges.map((edge) => ({
    ...edge,
    selected: edge.selected || edge.id === selectedEdgeId,
  }));

  return (
    <>
      <ReactFlow
        className={`h-full w-full ${connectSourceId ? "is-connecting" : ""} ${
          loopDrawMode ? "is-loop-drawing" : ""
        }`}
        nodes={nodesWithSelection}
        edges={edgesWithSelection}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onNodeDragStop={(_, _node, dragged) => {
          if (loopDrawMode) return;
          for (const node of dragged) {
            reparentAfterDrag(node.id);
          }
        }}
        onNodeClick={(event, node) => {
          if (loopDrawMode) return;
          if (event.shiftKey) {
            clearConnectClickTimer();
            cancelConnect();
            return;
          }

          const isConnecting = Boolean(
            useWorkflowStore.getState().connectSourceId
          );

          // Already connecting: complete / switch immediately.
          if (isConnecting) {
            clearConnectClickTimer();
            handleConnectNodeClick(node.id);
            return;
          }

          // Delay so a double-click can open the edit panel instead.
          clearConnectClickTimer();
          connectClickTimerRef.current = setTimeout(() => {
            connectClickTimerRef.current = null;
            handleConnectNodeClick(node.id);
          }, CONNECT_CLICK_DELAY_MS);
        }}
        onNodeDoubleClick={(_, node) => {
          if (loopDrawMode) return;
          clearConnectClickTimer();
          cancelConnect();
          selectNode(node.id);
        }}
        onEdgeClick={(_, edge) => {
          if (loopDrawMode) return;
          clearConnectClickTimer();
          selectEdge(edge.id);
        }}
        onPaneClick={() => {
          if (loopDrawMode) return;
          clearConnectClickTimer();
          cancelConnect();
          clearCanvasSelection();
        }}
        onNodesDelete={() => {
          clearConnectClickTimer();
          cancelConnect();
          selectNode(null);
        }}
        onEdgesDelete={() => selectEdge(null)}
        deleteKeyCode={loopDrawMode ? null : ["Backspace", "Delete"]}
        connectionRadius={40}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        selectionOnDrag={!loopDrawMode && !connectSourceId}
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
        panOnDrag={loopDrawMode ? false : [1, 2]}
        zoomOnScroll={!loopDrawMode}
        zoomOnPinch={!loopDrawMode}
        zoomOnDoubleClick={false}
        defaultEdgeOptions={{
          style: { stroke: "#60a5fa" },
        }}
      >
        <Background gap={16} size={1} color="#334155" />
        <Controls
          position="bottom-center"
          orientation="horizontal"
          showInteractive={false}
        />
        <MiniMap
          pannable
          zoomable
          position="top-right"
          style={{ right: 12, top: 12 }}
          maskColor="rgb(15 23 42 / 0.75)"
          bgColor="hsl(217 33% 17%)"
          nodeStrokeWidth={2}
          nodeBorderRadius={4}
          nodeColor={(node) => {
            switch (node.type) {
              case "input":
                return "#38bdf8";
              case "llm":
                return "#a78bfa";
              case "output":
                return "#34d399";
              case "loop":
                return "rgba(251, 191, 36, 0.28)";
              case "approval":
                return "#fb7185";
              default:
                return "#94a3b8";
            }
          }}
        />
        <MiniMapEdges />
        {!loopDrawMode && <NodeInspector />}
      </ReactFlow>

      {connectSourceId && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2">
          <div className="rounded-full border border-sky-400/40 bg-slate-900/90 px-4 py-1.5 text-sm text-sky-100 shadow-lg backdrop-blur-sm">
            Click a target node to connect · Double click to edit the node
          </div>
        </div>
      )}

      {loopDrawMode && <LoopDrawOverlay />}
    </>
  );
}

export function WorkflowEditor() {
  return (
    <ExecutionFab>
      <ReactFlowProvider>
        <div className="relative h-full w-full">
          <WorkflowCanvas />
        </div>
      </ReactFlowProvider>
      <AddNodeFab />
    </ExecutionFab>
  );
}
