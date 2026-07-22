"use client";

import { useEffect } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { AddNodeFab } from "@/components/editor/AddNodeFab";
import { ExecutionFab } from "@/components/editor/ExecutionFab";
import { LoopDrawOverlay } from "@/components/editor/LoopDrawOverlay";
import { MiniMapEdges } from "@/components/editor/MiniMapEdges";
import { NodeInspector } from "@/components/editor/NodeInspector";
import { nodeTypes } from "@/components/editor/nodes";
import { canBeTarget, isInnerNode } from "@/stores/workflowStore";
import { useWorkflowStore } from "@/stores/workflowStore";

function WorkflowCanvas() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
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

  const nodesWithSelection = nodes.map((node) => {
    const isConnectSource = node.id === connectSourceId;
    const nodeType = node.type as "input" | "llm" | "output" | "loop";
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
      selected: node.id === selectedNodeId,
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
    selected: edge.id === selectedEdgeId,
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
        onNodeClick={(_, node) => {
          if (loopDrawMode) return;
          handleConnectNodeClick(node.id);
        }}
        onEdgeClick={(_, edge) => {
          if (loopDrawMode) return;
          selectEdge(edge.id);
        }}
        onPaneClick={() => {
          if (loopDrawMode) return;
          cancelConnect();
          selectNode(null);
          selectEdge(null);
        }}
        onNodesDelete={() => {
          cancelConnect();
          selectNode(null);
        }}
        onEdgesDelete={() => selectEdge(null)}
        deleteKeyCode={loopDrawMode ? null : ["Backspace", "Delete"]}
        connectionRadius={40}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        panOnDrag={loopDrawMode ? false : [1, 2]}
        zoomOnScroll={!loopDrawMode}
        zoomOnPinch={!loopDrawMode}
        zoomOnDoubleClick={!loopDrawMode}
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
                return "#fbbf24";
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
            Click a target node to connect
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
