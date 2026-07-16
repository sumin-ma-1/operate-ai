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

interface WorkflowState {
  workflowId: string;
  workflowName: string;
  nodes: WorkflowNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  isRunning: boolean;
  lastResult: ExecuteWorkflowResponse | null;
  setWorkflowMeta: (id: string, name: string) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  selectNode: (nodeId: string | null) => void;
  addNode: (type: WorkflowNodeType) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
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
  isRunning: false,
  lastResult: null,

  setWorkflowMeta: (id, name) => set({ workflowId: id, workflowName: name }),

  setNodes: (nodes) => set({ nodes }),

  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) =>
    set({ nodes: applyNodeChanges(changes, get().nodes) }),

  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges) }),

  onConnect: (connection) =>
    set({ edges: addEdge(connection, get().edges) }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

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

  loadWorkflow: (workflow) =>
    set({
      workflowId: workflow.id,
      workflowName: workflow.name,
      nodes: workflow.nodes as WorkflowNode[],
      edges: workflow.edges,
      selectedNodeId: null,
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
        { id: "e-input-llm", source: inputNode.id, target: llmNode.id },
        { id: "e-llm-output", source: llmNode.id, target: outputNode.id },
      ],
      selectedNodeId: null,
      isRunning: false,
      lastResult: null,
    });
  },
}));
