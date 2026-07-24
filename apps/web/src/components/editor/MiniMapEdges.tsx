"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

function nodeSize(node: Node) {
  return {
    width: node.measured?.width ?? node.width ?? 160,
    height: node.measured?.height ?? node.height ?? 48,
  };
}

function nodeCenter(node: Node, nodesById: Map<string, Node>) {
  const { width, height } = nodeSize(node);
  const origin = absolutePosition(node, nodesById);
  return {
    x: origin.x + width / 2,
    y: origin.y + height / 2,
  };
}

/** Point where a ray from the node center toward `toward` hits the node border. */
function borderEndpoint(
  node: Node,
  nodesById: Map<string, Node>,
  toward: { x: number; y: number }
) {
  const { width, height } = nodeSize(node);
  const origin = absolutePosition(node, nodesById);
  const cx = origin.x + width / 2;
  const cy = origin.y + height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }

  const scaleX = Math.abs(dx) < 1e-6 ? Infinity : width / 2 / Math.abs(dx);
  const scaleY = Math.abs(dy) < 1e-6 ? Infinity : height / 2 / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

function edgeEndpoint(
  node: Node,
  nodesById: Map<string, Node>,
  role: "source" | "target"
) {
  const { width, height } = nodeSize(node);
  const origin = absolutePosition(node, nodesById);

  // Attach to loop border handles so I/O edges don't cross the interior.
  if (node.type === "loop") {
    return {
      x: role === "target" ? origin.x : origin.x + width,
      y: origin.y + height / 2,
    };
  }

  return {
    x: origin.x + width / 2,
    y: origin.y + height / 2,
  };
}

function edgeLine(
  edge: Edge,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  return (
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
    />
  );
}

/**
 * Renders connection lines inside the official MiniMap SVG.
 * React Flow MiniMap does not support edges natively.
 *
 * Outer edges stay under nodes. Inner-loop edges are painted above the
 * loop rect so they are not covered by the parent node fill.
 */
export function MiniMapEdges() {
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);
  const outerGroupRef = useRef<SVGGElement | null>(null);
  const innerGroupRef = useRef<SVGGElement | null>(null);
  const edges = useStore((state: ReactFlowState) => state.edges);
  const nodes = useStore((state: ReactFlowState) => state.nodes);

  const nodesById = useMemo(() => {
    const map = new Map<string, Node>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const { outerLines, innerLines } = useMemo(() => {
    const outer: ReactNode[] = [];
    const inner: ReactNode[] = [];

    for (const edge of edges) {
      const source = nodesById.get(edge.source);
      const target = nodesById.get(edge.target);
      if (!source || !target) continue;

      const isInner = Boolean(source.parentId && target.parentId);
      let from: { x: number; y: number };
      let to: { x: number; y: number };

      if (isInner) {
        // Inner edges are drawn above nodes, so attach to borders
        // instead of centers to avoid lines running through boxes.
        const sourceCenter = nodeCenter(source, nodesById);
        const targetCenter = nodeCenter(target, nodesById);
        from = borderEndpoint(source, nodesById, targetCenter);
        to = borderEndpoint(target, nodesById, sourceCenter);
      } else {
        from = edgeEndpoint(source, nodesById, "source");
        to = edgeEndpoint(target, nodesById, "target");
      }

      const line = edgeLine(edge, from, to);

      if (isInner) inner.push(line);
      else outer.push(line);
    }

    return { outerLines: outer, innerLines: inner };
  }, [edges, nodesById]);

  useLayoutEffect(() => {
    setSvg(
      document.querySelector(
        ".react-flow__minimap-svg"
      ) as SVGSVGElement | null
    );
  });

  useLayoutEffect(() => {
    const outerGroup = outerGroupRef.current;
    const innerGroup = innerGroupRef.current;
    if (!svg || !outerGroup || !innerGroup) return;

    const firstNode = svg.querySelector(".react-flow__minimap-node");
    if (firstNode && outerGroup.nextSibling !== firstNode) {
      svg.insertBefore(outerGroup, firstNode);
    }

    if (innerGroup.parentNode === svg && svg.lastChild !== innerGroup) {
      svg.appendChild(innerGroup);
    }
  });

  if (!svg) return null;

  return (
    <>
      {createPortal(
        <g ref={outerGroupRef} className="react-flow__minimap-edges">
          {outerLines}
        </g>,
        svg
      )}
      {createPortal(
        <g ref={innerGroupRef} className="react-flow__minimap-edges-inner">
          {innerLines}
        </g>,
        svg
      )}
    </>
  );
}
