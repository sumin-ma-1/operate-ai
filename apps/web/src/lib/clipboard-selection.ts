import type { Edge, Node } from "@xyflow/react";

import type { WorkflowNodeData, WorkflowNodeType } from "@operate-ai/workflow-schema";
import { getAbsolutePosition } from "@/lib/loop-membership";
import { OUTER_LLM_WIDTH } from "@/lib/wrap-nodes-in-loop";

export type WorkflowNode = Node<WorkflowNodeData, WorkflowNodeType>;
export type WorkflowEdge = Edge<{ disabled?: boolean }>;

export type WorkflowClipboard = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

const PASTE_OFFSET = 48;

function stripLoopInnerClass(className?: string) {
  const next = className
    ?.split(/\s+/)
    .filter((token) => token && token !== "loop-inner-node")
    .join(" ");
  return next || undefined;
}

function expandSelectionIds(nodes: WorkflowNode[]): Set<string> {
  const selectedIds = new Set(
    nodes.filter((node) => node.selected).map((node) => node.id)
  );

  // Selecting a loop includes its children in the clipboard.
  for (const node of nodes) {
    if (node.parentId && selectedIds.has(node.parentId)) {
      selectedIds.add(node.id);
    }
  }

  return selectedIds;
}

/** Snapshot selected nodes/edges for copy. Orphaned children are released to absolute coords. */
export function serializeSelection(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowClipboard | null {
  const selectedIds = expandSelectionIds(nodes);
  if (selectedIds.size === 0) return null;

  const selectedNodes = nodes
    .filter((node) => selectedIds.has(node.id))
    .map((node) => {
      const {
        selected: _selected,
        dragging: _dragging,
        measured: _measured,
        resizing: _resizing,
        positionAbsolute: _positionAbsolute,
        ...rest
      } = node as WorkflowNode & {
        dragging?: boolean;
        measured?: unknown;
        resizing?: boolean;
        positionAbsolute?: unknown;
      };

      if (node.parentId && !selectedIds.has(node.parentId)) {
        const absolute = getAbsolutePosition(node, nodes);
        const { parentId: _parentId, extent: _extent, ...withoutParent } = rest;
        return {
          ...withoutParent,
          position: absolute,
          className: stripLoopInnerClass(rest.className),
          style: {
            ...rest.style,
            width: OUTER_LLM_WIDTH,
          },
        } as WorkflowNode;
      }

      return rest as WorkflowNode;
    });

  const selectedEdges = edges
    .filter(
      (edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target)
    )
    .map((edge) => {
      const { selected: _selected, ...rest } = edge;
      return rest as WorkflowEdge;
    });

  return { nodes: selectedNodes, edges: selectedEdges };
}

export function materializeClipboard(args: {
  clipboard: WorkflowClipboard;
  createId: (type: WorkflowNodeType) => string;
}): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const idMap = new Map<string, string>();

  for (const node of args.clipboard.nodes) {
    idMap.set(node.id, args.createId(node.type as WorkflowNodeType));
  }

  const nodes = args.clipboard.nodes.map((node) => {
    const nextParentId =
      node.parentId && idMap.has(node.parentId)
        ? idMap.get(node.parentId)
        : undefined;

    return {
      ...node,
      id: idMap.get(node.id)!,
      parentId: nextParentId,
      selected: true,
      position: nextParentId
        ? node.position
        : {
            x: node.position.x + PASTE_OFFSET,
            y: node.position.y + PASTE_OFFSET,
          },
    } as WorkflowNode;
  });

  // Parents before children for React Flow.
  nodes.sort((a, b) => {
    if (a.type === "loop" && b.parentId === a.id) return -1;
    if (b.type === "loop" && a.parentId === b.id) return 1;
    if (a.parentId && !b.parentId) return 1;
    if (!a.parentId && b.parentId) return -1;
    return 0;
  });

  const edges = args.clipboard.edges
    .filter((edge) => idMap.has(edge.source) && idMap.has(edge.target))
    .map((edge) => ({
      ...edge,
      id: `edge-${idMap.get(edge.source)}-${idMap.get(edge.target)}-${Math.random().toString(36).slice(2, 7)}`,
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
      selected: false,
    }));

  return { nodes, edges };
}
