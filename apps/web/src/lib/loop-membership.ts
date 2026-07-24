import type { Edge, Node } from "@xyflow/react";

import type { WorkflowNodeData, WorkflowNodeType } from "@operate-ai/workflow-schema";
import { releaseChildFromLoop } from "@/lib/unwrap-loop";
import {
  getNodeDimensions,
  INNER_LLM_WIDTH,
  rewireEdgesForWrap,
  type FlowRect,
} from "@/lib/wrap-nodes-in-loop";

type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;
type WorkflowEdge = Edge<{ disabled?: boolean }>;

function pointInRect(
  point: { x: number; y: number },
  rect: FlowRect
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function getAbsolutePosition(
  node: WorkflowNode,
  nodes: WorkflowNode[]
): { x: number; y: number } {
  if (!node.parentId) {
    return { x: node.position.x, y: node.position.y };
  }

  const parent = nodes.find((item) => item.id === node.parentId);
  if (!parent) {
    return { x: node.position.x, y: node.position.y };
  }

  const parentAbs = getAbsolutePosition(parent, nodes);
  return {
    x: parentAbs.x + node.position.x,
    y: parentAbs.y + node.position.y,
  };
}

export function getLoopRect(loopNode: WorkflowNode): FlowRect {
  const { width, height } = getNodeDimensions(loopNode);
  return {
    x: loopNode.position.x,
    y: loopNode.position.y,
    width,
    height,
  };
}

export function findLoopContainingPoint(
  nodes: WorkflowNode[],
  point: { x: number; y: number }
): WorkflowNode | null {
  const hits = nodes.filter(
    (node) => node.type === "loop" && pointInRect(point, getLoopRect(node))
  );

  if (hits.length === 0) return null;

  return hits.reduce((best, node) => {
    const bestRect = getLoopRect(best);
    const nextRect = getLoopRect(node);
    const bestArea = bestRect.width * bestRect.height;
    const nextArea = nextRect.width * nextRect.height;
    return nextArea < bestArea ? node : best;
  });
}

function ensureLoopBeforeChildren(
  nodes: WorkflowNode[],
  loopId: string
): WorkflowNode[] {
  const loopNode = nodes.find((node) => node.id === loopId);
  if (!loopNode) return nodes;

  const others = nodes.filter((node) => node.id !== loopId);
  const children: WorkflowNode[] = [];
  const rest: WorkflowNode[] = [];

  for (const node of others) {
    if (node.parentId === loopId) {
      children.push(node);
    } else {
      rest.push(node);
    }
  }

  return [...rest, loopNode, ...children];
}

function rewireEdgesForRemoveFromLoop(
  edges: WorkflowEdge[],
  loopId: string,
  leavingId: string,
  remainingChildIds: Set<string>,
  styleEdge: (edge: WorkflowEdge) => WorkflowEdge
): WorkflowEdge[] {
  const result: WorkflowEdge[] = [];
  const seen = new Set<string>();

  const pushUnique = (edge: WorkflowEdge) => {
    const key = `${edge.source}->${edge.target}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(edge);
  };

  for (const edge of edges) {
    if (
      (edge.source === leavingId && edge.target === loopId) ||
      (edge.source === loopId && edge.target === leavingId)
    ) {
      continue;
    }

    const sourceLeaving = edge.source === leavingId;
    const targetLeaving = edge.target === leavingId;
    const sourceRemains = remainingChildIds.has(edge.source);
    const targetRemains = remainingChildIds.has(edge.target);

    if (sourceLeaving && targetRemains) {
      pushUnique(
        styleEdge({
          id: `leave-${leavingId}-${loopId}`,
          source: leavingId,
          target: loopId,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
          data: edge.data,
        })
      );
      continue;
    }

    if (sourceRemains && targetLeaving) {
      pushUnique(
        styleEdge({
          id: `leave-${loopId}-${leavingId}`,
          source: loopId,
          target: leavingId,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
          data: edge.data,
        })
      );
      continue;
    }

    pushUnique(edge);
  }

  return result;
}

export function removeNodeFromLoopGraph(args: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  loopId: string;
  nodeId: string;
  styleEdge: (edge: WorkflowEdge) => WorkflowEdge;
}): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null {
  const loopNode = args.nodes.find(
    (node) => node.id === args.loopId && node.type === "loop"
  );
  const child = args.nodes.find(
    (node) =>
      node.id === args.nodeId &&
      node.type === "llm" &&
      node.parentId === args.loopId
  );
  if (!loopNode || !child) return null;

  const remainingChildIds = new Set(
    args.nodes
      .filter(
        (node) => node.parentId === args.loopId && node.id !== args.nodeId
      )
      .map((node) => node.id)
  );

  const released = releaseChildFromLoop(child, loopNode);
  const nodes = args.nodes.map((node) =>
    node.id === args.nodeId ? released : node
  );

  return {
    nodes,
    edges: rewireEdgesForRemoveFromLoop(
      args.edges,
      args.loopId,
      args.nodeId,
      remainingChildIds,
      args.styleEdge
    ),
  };
}

export function addNodeToLoopGraph(args: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  loopId: string;
  nodeId: string;
  styleEdge: (edge: WorkflowEdge) => WorkflowEdge;
}): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null {
  const loopNode = args.nodes.find(
    (node) => node.id === args.loopId && node.type === "loop"
  );
  const node = args.nodes.find((item) => item.id === args.nodeId);
  if (!loopNode || !node || node.type !== "llm" || node.parentId) {
    return null;
  }

  const absolute = getAbsolutePosition(node, args.nodes);
  const { width } = getNodeDimensions(node);
  const reparented: WorkflowNode = {
    ...node,
    parentId: args.loopId,
    position: {
      x: absolute.x - loopNode.position.x,
      y: absolute.y - loopNode.position.y,
    },
    className: ["loop-inner-node", node.className]
      .filter(Boolean)
      .join(" "),
    style: {
      ...node.style,
      width: Math.min(width, INNER_LLM_WIDTH),
    },
  };

  const nodes = ensureLoopBeforeChildren(
    args.nodes.map((item) => (item.id === args.nodeId ? reparented : item)),
    args.loopId
  );

  const edgesWithoutLoopLinks = args.edges.filter(
    (edge) =>
      !(
        (edge.source === args.nodeId && edge.target === args.loopId) ||
        (edge.source === args.loopId && edge.target === args.nodeId)
      )
  );

  return {
    nodes,
    edges: rewireEdgesForWrap(
      edgesWithoutLoopLinks,
      new Set([args.nodeId]),
      args.loopId,
      args.styleEdge
    ),
  };
}

export function syncLoopMembershipOnDragStop(args: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  nodeId: string;
  styleEdge: (edge: WorkflowEdge) => WorkflowEdge;
}): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null {
  const node = args.nodes.find((item) => item.id === args.nodeId);
  if (!node || node.type !== "llm") return null;

  const { width, height } = getNodeDimensions(node);
  const absolute = getAbsolutePosition(node, args.nodes);
  const center = {
    x: absolute.x + width / 2,
    y: absolute.y + height / 2,
  };

  const containing = findLoopContainingPoint(args.nodes, center);
  const currentParent = node.parentId ?? null;
  const nextParent = containing?.id ?? null;

  if (currentParent === nextParent) return null;

  let nodes = args.nodes;
  let edges = args.edges;

  if (currentParent) {
    const removed = removeNodeFromLoopGraph({
      nodes,
      edges,
      loopId: currentParent,
      nodeId: args.nodeId,
      styleEdge: args.styleEdge,
    });
    if (!removed) return null;
    nodes = removed.nodes;
    edges = removed.edges;
  }

  if (nextParent) {
    const added = addNodeToLoopGraph({
      nodes,
      edges,
      loopId: nextParent,
      nodeId: args.nodeId,
      styleEdge: args.styleEdge,
    });
    if (!added) return null;
    nodes = added.nodes;
    edges = added.edges;
  }

  return { nodes, edges };
}
