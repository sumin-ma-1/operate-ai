"use client";

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

import { unwrapLoopGraph } from "@/lib/unwrap-loop";
import {
  createLoopFromDraw,
  getLlmsInRect,
  wrapNodesInLoopGraph,
  type FlowRect,
} from "@/lib/wrap-nodes-in-loop";

export type ExecutionNodeStatus = "pending" | "running" | "completed" | "failed";

export interface ExecutionProgressNode {
  nodeId: string;
  nodeType: WorkflowNodeType;
  label: string;
  status: ExecutionNodeStatus;
  message?: string;
  iteration?: number;
  maxIterations?: number;
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
  loopDrawMode: boolean;
  isRunning: boolean;
  executionPanelOpen: boolean;
  executionError: string | null;
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
  addNode: (type: WorkflowNodeType, position?: { x: number; y: number }) => void;
  startLoopDrawMode: () => void;
  cancelLoopDrawMode: () => void;
  completeLoopDraw: (bounds: FlowRect) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  removeNode: (nodeId: string) => void;
  unwrapLoop: (loopId: string) => void;
  removeEdge: (edgeId: string) => void;
  setEdgeDisabled: (edgeId: string, disabled: boolean) => void;
  loadWorkflow: (workflow: WorkflowDefinition) => void;
  toWorkflowDefinition: () => WorkflowDefinition;
  setRunning: (isRunning: boolean) => void;
  setExecutionPanelOpen: (open: boolean) => void;
  setExecutionError: (error: string | null) => void;
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
  return type === "input" || type === "llm" || type === "loop";
}

function canBeTarget(type: WorkflowNodeType | undefined) {
  return type === "llm" || type === "output" || type === "loop";
}

function isInnerNode(node: WorkflowNode) {
  return Boolean(node.parentId);
}

function isValidConnection(source: WorkflowNode, target: WorkflowNode) {
  const sourceType = source.type as WorkflowNodeType;
  const targetType = target.type as WorkflowNodeType;

  if (source.id === target.id) return false;
  if (sourceType === "output") return false;
  if (targetType === "input") return false;
  if (isInnerNode(source) && sourceType === "input") return false;
  if (isInnerNode(target) && targetType === "output") return false;

  const sourceParent = source.parentId;
  const targetParent = target.parentId;

  if (sourceParent && targetParent) {
    return (
      sourceParent === targetParent &&
      canBeSource(sourceType) &&
      canBeTarget(targetType)
    );
  }

  if (sourceParent || targetParent) {
    return false;
  }

  return canBeSource(sourceType) && canBeTarget(targetType);
}

let nodeCounter = 1;

function createDefaultNode(
  type: WorkflowNodeType,
  position?: { x: number; y: number }
): WorkflowNode {
  const id = `${type}-${nodeCounter++}`;
  const base = {
    id,
    type,
    position: position ?? {
      x: 100 + nodeCounter * 40,
      y: 100 + nodeCounter * 20,
    },
  };

  switch (type) {
    case "input":
      return {
        ...base,
        data: { label: "", value: "" },
      };
    case "llm":
      return {
        ...base,
        data: {
          label: "",
          model: "gemma4:e4b",
          systemPrompt: "You are a helpful assistant.",
        },
      };
    case "output":
      return {
        ...base,
        data: { label: "", result: "" },
      };
    case "loop":
      return {
        ...base,
        style: { width: 420, height: 200 },
        data: {
          label: "",
          goalPrompt: "The answer is complete and accurate.",
          maxIterations: 5,
        },
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
  loopDrawMode: false,
  isRunning: false,
  executionPanelOpen: false,
  executionError: null,
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
    set((state) => {
      const expandedChanges: NodeChange<WorkflowNode>[] = [...changes];

      for (const change of changes) {
        if (change.type !== "remove") continue;

        const target = state.nodes.find((node) => node.id === change.id);
        if (target?.type !== "loop") continue;

        for (const child of state.nodes.filter((node) => node.parentId === change.id)) {
          if (
            expandedChanges.some(
              (item) => item.type === "remove" && item.id === child.id
            )
          ) {
            continue;
          }
          expandedChanges.push({ type: "remove", id: child.id });
        }
      }

      const removedIds = new Set(
        expandedChanges
          .filter((change) => change.type === "remove")
          .map((change) => change.id)
      );

      return {
        nodes: applyNodeChanges(expandedChanges, state.nodes),
        edges:
          removedIds.size > 0
            ? state.edges.filter(
                (edge) =>
                  !removedIds.has(edge.source) && !removedIds.has(edge.target)
              )
            : state.edges,
        selectedNodeId: removedIds.has(state.selectedNodeId ?? "")
          ? null
          : state.selectedNodeId,
        connectSourceId: removedIds.has(state.connectSourceId ?? "")
          ? null
          : state.connectSourceId,
      };
    }),

  onEdgesChange: (changes) =>
    set({ edges: applyEdgeChanges(changes, get().edges).map(styleEdge) }),

  onConnect: (connection) => {
    const state = get();
    const source = state.nodes.find((node) => node.id === connection.source);
    const target = state.nodes.find((node) => node.id === connection.target);
    if (!source || !target || !isValidConnection(source, target)) return;

    set({
      edges: addEdge(
        { ...connection, data: { disabled: false } },
        state.edges
      ).map(styleEdge),
    });
  },

  selectNode: (nodeId) =>
    set({ selectedNodeId: nodeId, selectedEdgeId: null }),

  selectEdge: (edgeId) =>
    set({
      selectedEdgeId: edgeId,
      selectedNodeId: null,
      connectSourceId: null,
    }),

  setConnectSource: (nodeId) => set({ connectSourceId: nodeId }),

  cancelConnect: () => set({ connectSourceId: null }),

  handleConnectNodeClick: (nodeId) => {
    const state = get();
    const clicked = state.nodes.find((node) => node.id === nodeId);
    if (!clicked) return;

    const clickedType = clicked.type as WorkflowNodeType;

    if (state.connectSourceId) {
      if (state.connectSourceId === nodeId) {
        set({
          connectSourceId: null,
          selectedEdgeId: null,
        });
        return;
      }

      const source = state.nodes.find((node) => node.id === state.connectSourceId);
      if (
        source &&
        isValidConnection(source, clicked) &&
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
          selectedEdgeId: null,
        });
        return;
      }

      if (canBeSource(clickedType)) {
        set({
          connectSourceId: nodeId,
          selectedEdgeId: null,
        });
        return;
      }

      set({
        connectSourceId: null,
        selectedEdgeId: null,
      });
      return;
    }

    if (canBeSource(clickedType)) {
      set({
        connectSourceId: nodeId,
        selectedEdgeId: null,
      });
      return;
    }

    if (clickedType === "output" && state.lastResult) {
      set({
        selectedEdgeId: null,
        connectSourceId: null,
        executionPanelOpen: true,
      });
    }
  },

  addNode: (type, position) =>
    set((state) => ({
      nodes: [...state.nodes, createDefaultNode(type, position)],
    })),

  startLoopDrawMode: () =>
    set({
      loopDrawMode: true,
      connectSourceId: null,
      selectedEdgeId: null,
    }),

  cancelLoopDrawMode: () => set({ loopDrawMode: false }),

  completeLoopDraw: (bounds) =>
    set((state) => {
      const loopId = `loop-${nodeCounter++}`;
      const llms = getLlmsInRect(state.nodes, bounds);

      if (llms.length === 0) {
        const created = createLoopFromDraw({
          nodes: state.nodes,
          loopId,
          bounds,
        });
        return {
          nodes: created.nodes,
          selectedNodeId: loopId,
          selectedEdgeId: null,
          connectSourceId: null,
          loopDrawMode: false,
        };
      }

      const result = wrapNodesInLoopGraph({
        nodes: state.nodes,
        edges: state.edges,
        nodeIds: llms.map((node) => node.id),
        loopId,
        bounds,
        styleEdge,
      });

      if (!result) {
        return { loopDrawMode: false };
      }

      return {
        nodes: result.nodes,
        edges: result.edges,
        selectedNodeId: loopId,
        selectedEdgeId: null,
        connectSourceId: null,
        loopDrawMode: false,
      };
    }),

  updateNodeData: (nodeId, data) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } }
          : node
      ),
    })),

  removeNode: (nodeId) =>
    set((state) => {
      const target = state.nodes.find((node) => node.id === nodeId);
      const childIds =
        target?.type === "loop"
          ? state.nodes
              .filter((node) => node.parentId === nodeId)
              .map((node) => node.id)
          : [];
      const removeIds = new Set([nodeId, ...childIds]);

      return {
        nodes: state.nodes.filter((node) => !removeIds.has(node.id)),
        edges: state.edges.filter(
          (edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target)
        ),
        selectedNodeId: removeIds.has(state.selectedNodeId ?? "")
          ? null
          : state.selectedNodeId,
        connectSourceId: removeIds.has(state.connectSourceId ?? "")
          ? null
          : state.connectSourceId,
        selectedEdgeId: null,
      };
    }),

  unwrapLoop: (loopId) =>
    set((state) => {
      const result = unwrapLoopGraph({
        nodes: state.nodes,
        edges: state.edges,
        loopId,
        styleEdge,
      });

      if (!result) return {};

      return {
        nodes: result.nodes,
        edges: result.edges,
        selectedNodeId: state.selectedNodeId === loopId ? null : state.selectedNodeId,
        connectSourceId: state.connectSourceId === loopId ? null : state.connectSourceId,
        selectedEdgeId: null,
      };
    }),

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

  loadWorkflow: (workflow) => {
    const maxCounter = workflow.nodes.reduce((max, node) => {
      const match = node.id.match(/^(input|llm|output|loop)-(\d+)$/);
      if (!match) return max;
      return Math.max(max, Number(match[2]));
    }, 0);
    nodeCounter = maxCounter + 1;

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
      loopDrawMode: false,
      executionPanelOpen: false,
      executionError: null,
      lastResult: null,
      executionProgress: [],
    });
  },

  toWorkflowDefinition: () => {
    const state = get();
    return {
      id: state.workflowId,
      name: state.workflowName,
      nodes: state.nodes.map((node) => {
        const width =
          typeof node.style?.width === "number" ? node.style.width : undefined;
        const height =
          typeof node.style?.height === "number" ? node.style.height : undefined;

        return {
          id: node.id,
          type: node.type as WorkflowNodeType,
          position: node.position,
          data: node.data,
          ...(node.parentId ? { parentId: node.parentId } : {}),
          ...(width || height
            ? { style: { ...(width ? { width } : {}), ...(height ? { height } : {}) } }
            : {}),
          ...(node.extent === "parent" ? { extent: "parent" as const } : {}),
        };
      }),
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

  setExecutionPanelOpen: (open) => set({ executionPanelOpen: open }),

  setExecutionError: (error) => set({ executionError: error }),

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
      loopDrawMode: false,
      isRunning: false,
      executionPanelOpen: false,
      executionError: null,
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
      loopDrawMode: false,
      isRunning: false,
      executionPanelOpen: false,
      executionError: null,
      lastResult: null,
      executionProgress: [],
    });
  },
}));

export { canBeSource, canBeTarget, isInnerNode, isValidConnection };
