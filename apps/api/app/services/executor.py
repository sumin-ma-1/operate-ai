from collections import defaultdict, deque

from app.schemas import (
    ExecuteWorkflowRequest,
    ExecuteWorkflowResponse,
    NodeExecutionResult,
    WorkflowDefinition,
    WorkflowNode,
)
from app.services.ollama import OllamaService


class DAGExecutor:
    def __init__(self, ollama_service: OllamaService | None = None) -> None:
        self.ollama = ollama_service or OllamaService()

    def _topological_sort(
        self, nodes: list[WorkflowNode], edges: list
    ) -> list[WorkflowNode]:
        node_map = {node.id: node for node in nodes}
        in_degree: dict[str, int] = {node.id: 0 for node in nodes}
        adjacency: dict[str, list[str]] = defaultdict(list)

        for edge in edges:
            if edge.source in node_map and edge.target in node_map:
                adjacency[edge.source].append(edge.target)
                in_degree[edge.target] += 1

        queue = deque([node_id for node_id, degree in in_degree.items() if degree == 0])
        sorted_ids: list[str] = []

        while queue:
            current = queue.popleft()
            sorted_ids.append(current)
            for neighbor in adjacency[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if len(sorted_ids) != len(nodes):
            raise ValueError("Workflow contains a cycle or disconnected nodes")

        return [node_map[node_id] for node_id in sorted_ids]

    def _get_upstream_output(
        self, node_id: str, edges: list, node_outputs: dict[str, str]
    ) -> str:
        for edge in edges:
            if edge.target == node_id and edge.source in node_outputs:
                return node_outputs[edge.source]
        return ""

    async def execute(self, request: ExecuteWorkflowRequest) -> ExecuteWorkflowResponse:
        workflow = request.workflow
        node_results: list[NodeExecutionResult] = []
        node_outputs: dict[str, str] = {}
        final_output = ""

        try:
            sorted_nodes = self._topological_sort(workflow.nodes, workflow.edges)
        except ValueError as exc:
            return ExecuteWorkflowResponse(
                success=False,
                node_results=[],
                final_output="",
                error=str(exc),
            )

        for node in sorted_nodes:
            output = ""

            if node.type == "input":
                output = request.input or node.data.value or ""

            elif node.type == "llm":
                upstream = self._get_upstream_output(
                    node.id, workflow.edges, node_outputs
                )
                template = node.data.user_prompt_template or "{{input}}"
                user_prompt = template.replace("{{input}}", upstream)

                output = await self.ollama.chat(
                    model=node.data.model or "llama3",
                    user_message=user_prompt,
                    system_message=node.data.system_prompt,
                )

            elif node.type == "output":
                output = self._get_upstream_output(
                    node.id, workflow.edges, node_outputs
                )

            node_outputs[node.id] = output
            node_results.append(
                NodeExecutionResult(
                    nodeId=node.id,
                    nodeType=node.type,
                    output=output,
                )
            )
            final_output = output

        return ExecuteWorkflowResponse(
            success=True,
            node_results=node_results,
            final_output=final_output,
        )
