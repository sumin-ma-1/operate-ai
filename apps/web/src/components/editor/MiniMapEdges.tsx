"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore, type Edge, type Node, type ReactFlowState } from "@xyflow/react";

const EDGE_STROKE = "#60a5fa";
const EDGE_STROKE_WIDTH = 8;

function absolutePosition(node: Node, nodesById: Map<string, Node>) {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;

  while (parentId) {
    const parent = nodesById.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }

  return { x, y };
}

function nodeCenter(node: Node, nodesById: Map<string, Node>) {
  const width = node.measured?.width ?? node.width ?? 160;
  const height = node.measured?.height ?? node.height ?? 48;
  const origin = absolutePosition(node, nodesById);
  return {
    x: origin.x + width / 2,
    y: origin.y + height / 2,
  };
}

/**
 * Renders connection lines inside the official MiniMap SVG.
 * React Flow MiniMap does not support edges natively.
 */
export function MiniMapEdges() {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const groupRef = useRef<SVGGElement | null>(null);
  const edges = useStore((state: ReactFlowState) => state.edges);
  const nodes = useStore((state: ReactFlowState) => state.nodes);

  const nodesById = useMemo(() => {
    const map = new Map<string, Node>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  useLayoutEffect(() => {
    setSvg(
      document.querySelector(
        ".react-flow__minimap-svg"
      ) as SVGSVGElement | null
    );
  });

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!svg || !group) return;

    const firstNode = svg.querySelector(".react-flow__minimap-node");
    if (firstNode && group.nextSibling !== firstNode) {
      svg.insertBefore(group, firstNode);
    }
  });

  if (!svg) return null;

  const lines = edges.flatMap((edge: Edge) => {
    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);
    if (!source || !target) return [];

    const from = nodeCenter(source, nodesById);
    const to = nodeCenter(target, nodesById);

    return [
      <line
        key={edge.id}
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={EDGE_STROKE}
        strokeWidth={EDGE_STROKE_WIDTH}
        strokeLinecap="round"
        opacity={0.85}
      />,
    ];
  });

  return createPortal(
    <g ref={groupRef} className="react-flow__minimap-edges">
      {lines}
    </g>,
    svg
  );
}
