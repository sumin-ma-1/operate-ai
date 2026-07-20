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
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  isRunning: boolean;
  lastResult: ExecuteWorkflowResponse | null;
  setWorkflowMeta: (id: string, name: string) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;
  addNode: (type: WorkflowNodeType) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  removeNode: (nodeId: string) => void;
  removeEdge: (edgeId: string) => void;
  setEdgeDisabled: (edgeId: string, disabled: boolean) => void;
  loadWorkflow: (workflow: WorkflowDefinition) => void;
  toWorkflowDefinition: () => WorkflowDefinition;
  setRunning: (isRunning: boolean) => void;
  setLastResult: (result: ExecuteWorkflowResponse | null) => void;
  applyExecutionResults: (result: ExecuteWorkflowResponse) => void;
  reset: () => void;
  initDefaultWorkflow: (id: string, name: string) => void;
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
          model: "llama3",
          systemPrompt: "You are a helpful assistant.",
          userPromptTemplate: "{{input}}",
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
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  isRunning: false,
  lastResult: null,

  setWorkflowMeta: (id, name) => set({ workflowId: id, workflowName: name }),

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
    set({ selectedEdgeId: edgeId, selectedNodeId: null }),

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
      lastResult: null,
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
      nodes: [],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
      isRunning: false,
      lastResult: null,
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
      isRunning: false,
      lastResult: null,
    });
  },
}));
