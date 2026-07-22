import type { Edge, Node } from "@xyflow/react";

import type { WorkflowNodeData, WorkflowNodeType } from "@operate-ai/workflow-schema";

type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;
type WorkflowEdge = Edge<{ disabled?: boolean }>;

const OUTER_LLM_WIDTH = 220;

function stripLoopInnerClass(className?: string) {
  const next = className
    ?.split(/\s+/)
    .filter((token) => token && token !== "loop-inner-node")
    .join(" ");
  return next || undefined;
}

function getInnerEntryExitNodes(
  childIds: Set<string>,
  edges: WorkflowEdge[]
): { entryNodeIds: string[]; exitNodeIds: string[] } {
  const innerEdges = edges.filter(
    (edge) => childIds.has(edge.source) && childIds.has(edge.target)
  );

  const hasInnerIncoming = new Set<string>();
  const hasInnerOutgoing = new Set<string>();

  for (const edge of innerEdges) {
    hasInnerIncoming.add(edge.target);
    hasInnerOutgoing.add(edge.source);
  }

  const allChildren = [...childIds];
  const entryNodeIds = allChildren.filter((id) => !hasInnerIncoming.has(id));
  const exitNodeIds = allChildren.filter((id) => !hasInnerOutgoing.has(id));

  return {
    entryNodeIds: entryNodeIds.length > 0 ? entryNodeIds : allChildren,
    exitNodeIds: exitNodeIds.length > 0 ? exitNodeIds : allChildren,
  };
}

function releaseChildFromLoop(child: WorkflowNode, loopNode: WorkflowNode): WorkflowNode {
  const { parentId: _parentId, extent: _extent, className, ...rest } = child;

  return {
    ...rest,
    position: {
      x: loopNode.position.x + child.position.x,
      y: loopNode.position.y + child.position.y,
    },
    className: stripLoopInnerClass(className),
    style: {
      ...child.style,
      width: OUTER_LLM_WIDTH,
    },
  };
}

function rewireEdgesForUnwrap(
  edges: WorkflowEdge[],
  loopId: string,
  childIds: Set<string>,
  entryNodeIds: string[],
  exitNodeIds: string[],
  styleEdge: (edge: WorkflowEdge) => WorkflowEdge
): WorkflowEdge[] {
  const result: WorkflowEdge[] = [];
  const seen = new Set<string>();

  for (const edge of edges) {
    if (edge.source === loopId || edge.target === loopId) {
      continue;
    }
    result.push(edge);
  }

  for (const edge of edges) {
    if (edge.target !== loopId || childIds.has(edge.source)) {
      continue;
    }

    for (const entryId of entryNodeIds) {
      const key = `${edge.source}->${entryId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(
        styleEdge({
          id: `unwrap-${edge.source}-${entryId}`,
          source: edge.source,
          target: entryId,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
          data: edge.data,
        })
      );
    }
  }

  for (const edge of edges) {
    if (edge.source !== loopId || childIds.has(edge.target)) {
      continue;
    }

    for (const exitId of exitNodeIds) {
      const key = `${exitId}->${edge.target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(
        styleEdge({
          id: `unwrap-${exitId}-${edge.target}`,
          source: exitId,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
          data: edge.data,
        })
      );
    }
  }

  return result;
}

export function unwrapLoopGraph(args: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  loopId: string;
  styleEdge: (edge: WorkflowEdge) => WorkflowEdge;
}): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null {
  const loopNode = args.nodes.find(
    (node) => node.id === args.loopId && node.type === "loop"
  );
  if (!loopNode) return null;

  const children = args.nodes.filter((node) => node.parentId === args.loopId);
  const childIds = new Set(children.map((node) => node.id));

  if (children.length === 0) {
    return {
      nodes: args.nodes.filter((node) => node.id !== args.loopId),
      edges: args.edges.filter(
        (edge) => edge.source !== args.loopId && edge.target !== args.loopId
      ),
    };
  }

  const { entryNodeIds, exitNodeIds } = getInnerEntryExitNodes(childIds, args.edges);
  const released = children.map((child) => releaseChildFromLoop(child, loopNode));
  const otherNodes = args.nodes.filter(
    (node) => node.id !== args.loopId && !childIds.has(node.id)
  );

  return {
    nodes: [...otherNodes, ...released],
    edges: rewireEdgesForUnwrap(
      args.edges,
      args.loopId,
      childIds,
      entryNodeIds,
      exitNodeIds,
      args.styleEdge
    ),
  };
}
