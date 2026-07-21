import type { WorkflowNodeType } from "@operate-ai/workflow-schema";

type ExecutionNode = {
  id: string;
  type: WorkflowNodeType;
  label: string;
};

type ExecutionEdge = {
  source: string;
  target: string;
  disabled?: boolean;
};

export function getExecutionOrder(
  nodes: ExecutionNode[],
  edges: ExecutionEdge[]
): ExecutionNode[] {
  const activeEdges = edges.filter((edge) => !edge.disabled);
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const inDegree = new Map(nodes.map((node) => [node.id, 0]));
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    adjacency.set(node.id, []);
  }

  for (const edge of activeEdges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) continue;
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  const queue = nodes
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

  return sorted.length === nodes.length ? sorted : nodes;
}

export function getExecutionMessage(
  nodeType: WorkflowNodeType,
  model?: string
): string {
  if (nodeType === "input") {
    return "Reading input and attachments";
  }
  if (nodeType === "llm") {
    return `Calling Ollama (${model || "gemma4:e4b"})`;
  }
  if (nodeType === "output") {
    return "Collecting final output";
  }
  return "Running node";
}
