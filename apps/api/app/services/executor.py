import json
from collections.abc import AsyncIterator
from typing import Any

from app.schemas import (
    ExecuteWorkflowRequest,
    ExecuteWorkflowResponse,
    NodeExecutionResult,
    WorkflowNode,
)
from app.services.input_content import (
    build_input_text,
    build_llm_user_prompt,
    collect_upstream_images,
    get_upstream_source,
)
from app.services.ollama import OllamaService


class DAGExecutor:
    def __init__(self, ollama_service: OllamaService | None = None) -> None:
        self.ollama = ollama_service or OllamaService()

    def _active_edges(self, edges: list) -> list:
        return [edge for edge in edges if not getattr(edge, "disabled", False)]

    def _topological_sort(
        self, nodes: list[WorkflowNode], edges: list
    ) -> list[WorkflowNode]:
        from collections import defaultdict, deque

        node_map = {node.id: node for node in nodes}
        in_degree: dict[str, int] = {node.id: 0 for node in nodes}
        adjacency: dict[str, list[str]] = defaultdict(list)

        for edge in self._active_edges(edges):
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
        for edge in self._active_edges(edges):
            if edge.target == node_id and edge.source in node_outputs:
                return node_outputs[edge.source]
        return ""

    def _node_message(self, node: WorkflowNode) -> str:
        if node.type == "input":
            return "Reading input and attachments"
        if node.type == "llm":
            model = node.data.model or "gemma4:e4b"
            return f"Calling Ollama ({model})"
        if node.type == "output":
            return "Collecting final output"
        return "Running node"

    async def execute_stream(
        self, request: ExecuteWorkflowRequest
    ) -> AsyncIterator[dict[str, Any]]:
        workflow = request.workflow
        node_results: list[NodeExecutionResult] = []
        node_outputs: dict[str, str] = {}
        original_input_text = ""
        final_output = ""

        try:
            sorted_nodes = self._topological_sort(workflow.nodes, workflow.edges)
        except ValueError as exc:
            yield {"type": "failed", "error": str(exc)}
            return

        yield {
            "type": "started",
            "nodes": [
                {
                    "nodeId": node.id,
                    "nodeType": node.type,
                    "label": node.data.label,
                }
                for node in sorted_nodes
            ],
        }

        for node in sorted_nodes:
            yield {
                "type": "node_started",
                "nodeId": node.id,
                "nodeType": node.type,
                "label": node.data.label,
                "message": self._node_message(node),
            }

            output = ""

            if node.type == "input":
                try:
                    output = build_input_text(node, request.input)
                    original_input_text = output
                except ValueError as exc:
                    yield {
                        "type": "node_failed",
                        "nodeId": node.id,
                        "error": str(exc),
                    }
                    yield {"type": "failed", "error": str(exc)}
                    return

            elif node.type == "llm":
                active_edges = self._active_edges(workflow.edges)
                upstream_output = self._get_upstream_output(
                    node.id, workflow.edges, node_outputs
                )
                upstream_source = get_upstream_source(
                    node.id, workflow.nodes, active_edges
                )
                user_prompt = build_llm_user_prompt(
                    original_input_text,
                    upstream_output,
                    upstream_source.type if upstream_source else None,
                )
                model = node.data.model or "gemma4:e4b"
                images = collect_upstream_images(
                    node.id, workflow.nodes, workflow.edges, active_edges
                )

                try:
                    output = await self.ollama.chat(
                        model=model,
                        user_message=user_prompt,
                        system_message=node.data.system_prompt,
                        images=images or None,
                    )
                except Exception as exc:
                    yield {
                        "type": "node_failed",
                        "nodeId": node.id,
                        "error": str(exc),
                    }
                    yield {"type": "failed", "error": str(exc)}
                    return

            elif node.type == "output":
                output = self._get_upstream_output(
                    node.id, workflow.edges, node_outputs
                )

            node_outputs[node.id] = output
            result = NodeExecutionResult(
                nodeId=node.id,
                nodeType=node.type,
                output=output,
            )
            node_results.append(result)
            final_output = output

            yield {
                "type": "node_completed",
                "nodeId": node.id,
                "nodeType": node.type,
                "output": output,
            }

        yield {
            "type": "completed",
            "success": True,
            "nodeResults": [
                result.model_dump(by_alias=True) for result in node_results
            ],
            "finalOutput": final_output,
        }

    async def execute(self, request: ExecuteWorkflowRequest) -> ExecuteWorkflowResponse:
        node_results: list[NodeExecutionResult] = []
        final_output = ""

        async for event in self.execute_stream(request):
            if event["type"] == "node_completed":
                node_results.append(
                    NodeExecutionResult(
                        nodeId=event["nodeId"],
                        nodeType=event["nodeType"],
                        output=event.get("output", ""),
                    )
                )
                final_output = event.get("output", "")
            elif event["type"] == "failed":
                return ExecuteWorkflowResponse(
                    success=False,
                    node_results=node_results,
                    final_output="",
                    error=event.get("error"),
                )
            elif event["type"] == "completed":
                return ExecuteWorkflowResponse(
                    success=True,
                    node_results=node_results,
                    final_output=final_output,
                )

        return ExecuteWorkflowResponse(
            success=False,
            node_results=node_results,
            final_output="",
            error="Workflow execution ended unexpectedly",
        )

    @staticmethod
    def format_sse(event: dict[str, Any]) -> str:
        return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
