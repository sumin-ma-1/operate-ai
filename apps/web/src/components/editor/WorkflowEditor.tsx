"use client";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { NodePalette } from "@/components/editor/NodePalette";
import { PropertyPanel } from "@/components/editor/PropertyPanel";
import { RunPanel } from "@/components/editor/RunPanel";
import { nodeTypes } from "@/components/editor/nodes";
import { useWorkflowStore } from "@/stores/workflowStore";

function WorkflowCanvas() {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const selectedEdgeId = useWorkflowStore((state) => state.selectedEdgeId);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const onConnect = useWorkflowStore((state) => state.onConnect);
  const selectNode = useWorkflowStore((state) => state.selectNode);
  const selectEdge = useWorkflowStore((state) => state.selectEdge);

  const edgesWithSelection = edges.map((edge) => ({
    ...edge,
    selected: edge.id === selectedEdgeId,
  }));

  return (
    <ReactFlow
      nodes={nodes}
      edges={edgesWithSelection}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={(_, node) => selectNode(node.id)}
      onEdgeClick={(_, edge) => selectEdge(edge.id)}
      onPaneClick={() => {
        selectNode(null);
        selectEdge(null);
      }}
      onNodesDelete={() => selectNode(null)}
      onEdgesDelete={() => selectEdge(null)}
      deleteKeyCode={["Backspace", "Delete"]}
      nodeTypes={nodeTypes}
      colorMode="dark"
      fitView
      defaultEdgeOptions={{
        style: { stroke: "#60a5fa" },
      }}
    >
      <Background gap={16} size={1} color="#334155" />
      <Controls />
      <MiniMap
        pannable
        zoomable
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
    </ReactFlow>
  );
}

export function WorkflowEditor() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <NodePalette />
        <div className="min-w-0 flex-1">
          <ReactFlowProvider>
            <WorkflowCanvas />
          </ReactFlowProvider>
        </div>
        <PropertyPanel />
      </div>
      <RunPanel />
    </div>
  );
}
