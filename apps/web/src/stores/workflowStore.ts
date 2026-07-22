import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";

import type {
  ExecuteWorkflowResponse,
  WorkflowDefinition,
  WorkflowNodeData,
  WorkflowNodeType,
} from "@operate-ai/workflow-schema";

export type ExecutionNodeStatus = "pending" | "running" | "completed" | "failed";

export interface ExecutionProgressNode {
  nodeId: string;
  nodeType: WorkflowNodeType;
  label: string;
  status: ExecutionNodeStatus;
  message?: string;
}

type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;

export type WorkflowEdgeData = {
  disabled?: boolean;
};

export type WorkflowEdge = Edge<WorkflowEdgeData>;

function styleEdge(edge: WorkflowEdge): WorkflowEdge {
  const disabled = Boolean(edge.data?.disabled);
  return {
    ...edge,
    animated: false,
    style: disabled
      ? { stroke: "#64748b", strokeDasharray: "6 4", opacity: 0.55 }
      : { stroke: "#60a5fa", opacity: 1 },
  };
}

interface WorkflowState {
  workflowId: string;
  workflowName: string;
  updatedAt: string | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  connectSourceId: string | null;
  isRunning: boolean;
  lastResult: ExecuteWorkflowResponse | null;
  executionProgress: ExecutionProgressNode[];
  setWorkflowMeta: (id: string, name: string, updatedAt?: string | null) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  setConnectSource: (nodeId: string | null) => void;
  handleConnectNodeClick: (nodeId: string) => void;
  cancelConnect: () => void;
  addNode: (type: WorkflowNodeType) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  setEdgeDisabled: (edgeId: string, disabled: boolean) => void;
  loadWorkflow: (workflow: WorkflowDefinition) => void;
  toWorkflowDefinition: () => WorkflowDefinition;
  setRunning: (isRunning: boolean) => void;
  setExecutionProgress: (items: ExecutionProgressNode[]) => void;
  updateExecutionProgress: (
    nodeId: string,
    update: Partial<ExecutionProgressNode>
  ) => void;
  clearExecutionProgress: () => void;
  setLastResult: (result: ExecuteWorkflowResponse | null) => void;
  applyExecutionResults: (result: ExecuteWorkflowResponse) => void;
  reset: () => void;
  initDefaultWorkflow: (id: string, name: string) => void;
}

function canBeSource(type: WorkflowNodeType | undefined) {
  return type === "input" || type === "llm";
}

function canBeTarget(type: WorkflowNodeType | undefined) {
  return type === "llm" || type === "output";
}

let nodeCounter = 1;

function createDefaultNode(type: WorkflowNodeType): WorkflowNode {
  const id = `${type}-${nodeCounter++}`;
  const base = {
    id,
    type,
    position: { x: 100 + nodeCounter * 40, y: 100 + nodeCounter * 20 },
  };

  switch (type) {
    case "input":
      return {
        ...base,
        data: { label: "Input", value: "" },
      };
    case "llm":
      return {
        ...base,
        data: {
          label: "LLM",
          model: "gemma4:e4b",
          systemPrompt: "You are a helpful assistant.",
        },
      };
    case "output":
      return {
        ...base,
        data: { label: "Output", result: "" },
      };
  }
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflowId: "",
  workflowName: "Untitled Workflow",
  updatedAt: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  connectSourceId: null,
  isRunning: false,
  lastResult: null,
  executionProgress: [],

  setWorkflowMeta: (id, name, updatedAt) =>
    set((state) => ({
      workflowId: id,
      workflowName: name,
      updatedAt: updatedAt === undefined ? state.updatedAt : updatedAt,
    })),

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges: edges.map(styleEdge) }),

  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) }),

  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges).map(styleEdge) }),

  onConnect: (connection) =>
    set({
      edges: addEdge(
        { ...connection, data: { disabled: false } },
        get().edges
      ).map(styleEdge),
    }),

  selectNode: (nodeId) =>
    set({ selectedNodeId: nodeId, selectedEdgeId: null }),

  selectEdge: (edgeId) =>
    set({ selectedEdgeId: edgeId, selectedNodeId: null, connectSourceId: null }),

  setConnectSource: (nodeId) => set({ connectSourceId: nodeId }),

  cancelConnect: () => set({ connectSourceId: null }),

  handleConnectNodeClick: (nodeId) => {
    const state = get();
    const clicked = state.nodes.find((node) => node.id === nodeId);
    if (!clicked) return;

    const clickedType = clicked.type as WorkflowNodeType;

    // Already connecting from a source node
    if (state.connectSourceId) {
      if (state.connectSourceId === nodeId) {
        set({ connectSourceId: null, selectedNodeId: nodeId, selectedEdgeId: null });
        return;
      }

      const source = state.nodes.find((node) => node.id === state.connectSourceId);
      const sourceType = source?.type as WorkflowNodeType | undefined;

      if (
        source &&
        canBeSource(sourceType) &&
        canBeTarget(clickedType) &&
        !state.edges.some(
          (edge) =>
            edge.source === state.connectSourceId && edge.target === nodeId
        )
      ) {
        set({
          edges: addEdge(
            {
              source: state.connectSourceId,
              target: nodeId,
              sourceHandle: null,
              targetHandle: null,
              data: { disabled: false },
            },
            state.edges
          ).map(styleEdge),
          connectSourceId: null,
          selectedNodeId: nodeId,
          selectedEdgeId: null,
        });
        return;
      }

      // Invalid target: restart connect from this node if it can be a source
      if (canBeSource(clickedType)) {
        set({
          connectSourceId: nodeId,
          selectedNodeId: nodeId,
          selectedEdgeId: null,
        });
        return;
      }

      set({
        connectSourceId: null,
        selectedNodeId: nodeId,
        selectedEdgeId: null,
      });
      return;
    }

    // Start connect mode from a source-capable node
    if (canBeSource(clickedType)) {
      set({
        connectSourceId: nodeId,
        selectedNodeId: nodeId,
        selectedEdgeId: null,
      });
      return;
    }

    set({ selectedNodeId: nodeId, selectedEdgeId: null, connectSourceId: null });
  },

  addNode: (type) =>
    set((state) => ({
      nodes: [...state.nodes, createDefaultNode(type)],
    })),

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    })),

  removeNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
      selectedNodeId:
        state.selectedNodeId === nodeId ? null : state.selectedNodeId,
      connectSourceId:
        state.connectSourceId === nodeId ? null : state.connectSourceId,
      selectedEdgeId: null,
    })),

  removeEdge: (edgeId) =>
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
      selectedEdgeId:
        state.selectedEdgeId === edgeId ? null : state.selectedEdgeId,
    })),

  setEdgeDisabled: (edgeId, disabled) =>
    set((state) => ({
      edges: state.edges
        .map((edge) =>
          edge.id === edgeId
            ? { ...edge, data: { ...edge.data, disabled } }
            : edge
        )
        .map(styleEdge),
    })),

  loadWorkflow: (workflow) =>
    set({
      workflowId: workflow.id,
      workflowName: workflow.name,
      updatedAt: workflow.updatedAt || workflow.createdAt || null,
      nodes: workflow.nodes as WorkflowNode[],
      edges: workflow.edges.map((edge) =>
        styleEdge({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle,
          targetHandle: edge.targetHandle,
          data: { disabled: Boolean(edge.disabled) },
        })
      ),
      selectedNodeId: null,
      selectedEdgeId: null,
      connectSourceId: null,
      lastResult: null,
      executionProgress: [],
    }),

  toWorkflowDefinition: () => {
    const state = get();
    return {
      id: state.workflowId,
      name: state.workflowName,
      nodes: state.nodes.map((node) => ({
        id: node.id,
        type: node.type as WorkflowNodeType,
        position: node.position,
        data: node.data,
      })),
      edges: state.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        disabled: Boolean(edge.data?.disabled),
      })),
    };
  },

  setRunning: (isRunning) => set({ isRunning }),

  setExecutionProgress: (items) => set({ executionProgress: items }),

  updateExecutionProgress: (nodeId, update) =>
    set((state) => ({
      executionProgress: state.executionProgress.map((item) =>
        item.nodeId === nodeId ? { ...item, ...update } : item
      ),
    })),

  clearExecutionProgress: () => set({ executionProgress: [] }),

  setLastResult: (result) => set({ lastResult: result }),

  applyExecutionResults: (result) =>
    set((state) => ({
      lastResult: result,
      nodes: state.nodes.map((node) => {
        const nodeResult = result.nodeResults.find((r) => r.nodeId === node.id);
        if (!nodeResult) return node;
        if (node.type === "output") {
          return { ...node, data: { ...node.data, result: nodeResult.output } };
        }
        return node;
      }),
    })),

  reset: () =>
    set({
      workflowId: "",
      workflowName: "Untitled Workflow",
      updatedAt: null,
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      connectSourceId: null,
      isRunning: false,
      lastResult: null,
      executionProgress: [],
    }),

  initDefaultWorkflow: (id, name) => {
    nodeCounter = 4;
    const inputNode = createDefaultNode("input");
    const llmNode = createDefaultNode("llm");
    const outputNode = createDefaultNode("output");

    inputNode.position = { x: 80, y: 120 };
    llmNode.position = { x: 360, y: 120 };
    outputNode.position = { x: 640, y: 120 };

    set({
      workflowId: id,
      workflowName: name,
      updatedAt: null,
      nodes: [inputNode, llmNode, outputNode],
      edges: [
        styleEdge({
          id: "e-input-llm",
          source: inputNode.id,
          target: llmNode.id,
          data: { disabled: false },
        }),
        styleEdge({
          id: "e-llm-output",
          source: llmNode.id,
          target: outputNode.id,
          data: { disabled: false },
        }),
      ],
      selectedNodeId: null,
      selectedEdgeId: null,
      connectSourceId: null,
      isRunning: false,
      lastResult: null,
      executionProgress: [],
    });
  },
}));
