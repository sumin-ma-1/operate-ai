import type { Edge, Node } from "@xyflow/react";

import type { WorkflowNodeData, WorkflowNodeType } from "@operate-ai/workflow-schema";

type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;
type WorkflowEdge = Edge<{ disabled?: boolean }>;

export type FlowRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const OUTER_LLM_WIDTH = 220;
export const INNER_LLM_WIDTH = 160;
export const DEFAULT_NODE_HEIGHT = 96;
const MIN_LOOP_WIDTH = 280;
const MIN_LOOP_HEIGHT = 160;

export function getNodeDimensions(node: WorkflowNode) {
  const width =
    typeof node.style?.width === "number"
      ? node.style.width
      : node.parentId
        ? INNER_LLM_WIDTH
        : OUTER_LLM_WIDTH;
  const height =
    typeof node.style?.height === "number" ? node.style.height : DEFAULT_NODE_HEIGHT;

  return { width, height };
}

function rectsIntersect(a: FlowRect, b: FlowRect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function getLlmsInRect(nodes: WorkflowNode[], rect: FlowRect): WorkflowNode[] {
  return nodes.filter((node) => {
    if (node.type !== "llm" || node.parentId) return false;
    const { width, height } = getNodeDimensions(node);
    return rectsIntersect(rect, {
      x: node.position.x,
      y: node.position.y,
      width,
      height,
    });
  });
}

export function rewireEdgesForWrap(
  edges: WorkflowEdge[],
  wrappedIds: Set<string>,
  loopId: string,
  styleEdge: (edge: WorkflowEdge) => WorkflowEdge
): WorkflowEdge[] {
  const result: WorkflowEdge[] = [];
  const seen = new Set<string>();

  for (const edge of edges) {
    const sourceInside = wrappedIds.has(edge.source);
    const targetInside = wrappedIds.has(edge.target);

    if (sourceInside && targetInside) {
      result.push(edge);
      continue;
    }

    if (!sourceInside && targetInside) {
      const key = `${edge.source}->${loopId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(
        styleEdge({
          id: `wrap-${edge.source}-${loopId}`,
          source: edge.source,
          target: loopId,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
          data: edge.data,
        })
      );
      continue;
    }

    if (sourceInside && !targetInside) {
      const key = `${loopId}->${edge.target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(
        styleEdge({
          id: `wrap-${loopId}-${edge.target}`,
          source: loopId,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
          data: edge.data,
        })
      );
      continue;
    }

    result.push(edge);
  }

  return result;
}

function createLoopNode(loopId: string, bounds: FlowRect): WorkflowNode {
  return {
    id: loopId,
    type: "loop",
    position: { x: bounds.x, y: bounds.y },
    style: {
      width: Math.max(MIN_LOOP_WIDTH, bounds.width),
      height: Math.max(MIN_LOOP_HEIGHT, bounds.height),
    },
    zIndex: 0,
    data: {
      label: "",
      goalPrompt: "The answer is complete and accurate.",
      maxIterations: 5,
    },
  };
}

export function createLoopFromDraw(args: {
  nodes: WorkflowNode[];
  loopId: string;
  bounds: FlowRect;
}): { nodes: WorkflowNode[] } {
  return {
    nodes: [...args.nodes, createLoopNode(args.loopId, args.bounds)],
  };
}

export function wrapNodesInLoopGraph(args: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  nodeIds: string[];
  loopId: string;
  bounds: FlowRect;
  styleEdge: (edge: WorkflowEdge) => WorkflowEdge;
}): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null {
  const idSet = new Set(args.nodeIds);
  const targets = args.nodes.filter(
    (node) =>
      idSet.has(node.id) && node.type === "llm" && !node.parentId
  );

  if (targets.length === 0) return null;

  const wrappedIds = new Set(targets.map((node) => node.id));
  const loopNode = createLoopNode(args.loopId, args.bounds);

  const reparented = targets.map((node) => {
    const { width } = getNodeDimensions(node);
    return {
      ...node,
      parentId: args.loopId,
      position: {
        x: node.position.x - loopNode.position.x,
        y: node.position.y - loopNode.position.y,
      },
      className: ["loop-inner-node", node.className].filter(Boolean).join(" "),
      style: {
        ...node.style,
        width: Math.min(width, INNER_LLM_WIDTH),
      },
    };
  });

  const untouched = args.nodes.filter((node) => !wrappedIds.has(node.id));
  const edges = rewireEdgesForWrap(
    args.edges,
    wrappedIds,
    args.loopId,
    args.styleEdge
  );

  return {
    nodes: [...untouched, loopNode, ...reparented],
    edges,
  };
}
