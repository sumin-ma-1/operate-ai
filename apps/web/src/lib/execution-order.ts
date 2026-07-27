import type { WorkflowNodeType } from "@operate-ai/workflow-schema";

type ExecutionNode = {
  id: string;
  type: WorkflowNodeType;
  label: string;
  parentId?: string;
};

type ExecutionEdge = {
  source: string;
  target: string;
  disabled?: boolean;
};

/** Outer-graph nodes reachable by following active edges from startNodeId. */
export function getReachableNodeIds(
  startNodeId: string,
  nodes: ExecutionNode[],
  edges: ExecutionEdge[]
): Set<string> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (!nodeIds.has(startNodeId)) {
    return new Set();
  }

  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of edges) {
    if (edge.disabled) continue;
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
    adjacency.get(edge.source)?.push(edge.target);
  }

  const seen = new Set<string>();
  const stack = [startNodeId];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || seen.has(currentId)) continue;
    seen.add(currentId);
    for (const neighbor of adjacency.get(currentId) || []) {
      stack.push(neighbor);
    }
  }

  return seen;
}

export function getExecutionOrder(
  nodes: ExecutionNode[],
  edges: ExecutionEdge[],
  startNodeId?: string
): ExecutionNode[] {
  const outerNodes = nodes.filter((node) => !node.parentId);
  const activeEdges = edges.filter((edge) => !edge.disabled);

  const scopedNodes = startNodeId
    ? outerNodes.filter((node) =>
        getReachableNodeIds(startNodeId, outerNodes, activeEdges).has(node.id)
      )
    : outerNodes;

  const nodeMap = new Map(scopedNodes.map((node) => [node.id, node]));
  const inDegree = new Map(scopedNodes.map((node) => [node.id, 0]));
  const adjacency = new Map<string, string[]>();

  for (const node of scopedNodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of activeEdges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue;
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  const queue = scopedNodes
    .map((node) => node.id)
    .filter((nodeId) => (inDegree.get(nodeId) || 0) === 0);
  const sorted: ExecutionNode[] = [];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;

    const current = nodeMap.get(currentId);
    if (!current) continue;

    sorted.push(current);

    for (const neighbor of adjacency.get(currentId) || []) {
      const nextDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, nextDegree);
      if (nextDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  return sorted.length === scopedNodes.length ? sorted : scopedNodes;
}

export function getExecutionMessage(
  nodeType: WorkflowNodeType,
  model?: string,
  provider?: string
): string {
  if (nodeType === "input") {
    return "Reading input and attachments";
  }
  if (nodeType === "llm") {
    const backend = provider || "ollama";
    return `Calling ${backend} (${model || "gemma4:e4b"})`;
  }
  if (nodeType === "output") {
    return "Collecting final output";
  }
  if (nodeType === "loop") {
    return "Running agent loop until goal";
  }
  if (nodeType === "approval") {
    return "Waiting for user approval";
  }
  return "Running node";
}
