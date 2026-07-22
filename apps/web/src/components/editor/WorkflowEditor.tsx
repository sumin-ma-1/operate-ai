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
import { MiniMapEdges } from "@/components/editor/MiniMapEdges";
import { NodeInspector } from "@/components/editor/NodeInspector";
import { nodeTypes } from "@/components/editor/nodes";
import { useWorkflowStore } from "@/stores/workflowStore";

function WorkflowCanvas() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((state) => state.selectedEdgeId);
  const connectSourceId = useWorkflowStore((state) => state.connectSourceId);
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
    const isValidTarget =
      Boolean(connectSourceId) &&
      node.id !== connectSourceId &&
      (node.type === "llm" || node.type === "output");

    return {
      ...node,
      selected: node.id === selectedNodeId,
      className: [
        node.className,
        isConnectSource ? "is-connect-source" : "",
        isValidTarget ? "is-connect-target" : "",
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
        className={`h-full w-full ${connectSourceId ? "is-connecting" : ""}`}
        nodes={nodesWithSelection}
        edges={edgesWithSelection}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, node) => handleConnectNodeClick(node.id)}
        onEdgeClick={(_, edge) => selectEdge(edge.id)}
        onPaneClick={() => {
          cancelConnect();
          selectNode(null);
          selectEdge(null);
        }}
        onNodesDelete={() => {
          cancelConnect();
          selectNode(null);
        }}
        onEdgesDelete={() => selectEdge(null)}
        deleteKeyCode={["Backspace", "Delete"]}
        connectionRadius={40}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        defaultEdgeOptions={{
          style: { stroke: "#60a5fa" },
        }}
      >
        <Background gap={16} size={1} color="#334155" />
        <Controls position="bottom-center" orientation="horizontal" />
        <MiniMap
          pannable
          zoomable
          position="bottom-left"
          style={{ left: 12, bottom: 12 }}
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
              default:
                return "#94a3b8";
            }
          }}
        />
        <MiniMapEdges />
        <NodeInspector />
      </ReactFlow>

      {connectSourceId && (
        <div className="pointer-events-none absolute top-4 left-1/2 z-20 -translate-x-1/2">
          <div className="rounded-full border border-sky-400/40 bg-slate-900/90 px-4 py-1.5 text-sm text-sky-100 shadow-lg backdrop-blur-sm">
            Click a target node to connect
          </div>
        </div>
      )}
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
