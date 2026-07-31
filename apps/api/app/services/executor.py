import asyncio
import json
import uuid
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
from app.services.loop_executor import LoopExecutor
from app.services.llm.factory import get_llm_client
from app.services.ollama import OllamaService
from app.services.run_registry import run_registry
from app.services.tool_loop import run_tool_loop


class DAGExecutor:
    def __init__(self, ollama_service: OllamaService | None = None) -> None:
        self.ollama = ollama_service or OllamaService()
        self.loop_executor = LoopExecutor(self.ollama)

    def _active_edges(self, edges: list) -> list:
        return [edge for edge in edges if not getattr(edge, "disabled", False)]

    def _outer_nodes(self, nodes: list[WorkflowNode]) -> list[WorkflowNode]:
        return [node for node in nodes if not node.parent_id]

    def _reachable_from(
        self,
        start_node_id: str,
        nodes: list[WorkflowNode],
        edges: list,
    ) -> list[WorkflowNode]:
        from collections import defaultdict

        node_map = {node.id: node for node in nodes}
        if start_node_id not in node_map:
            raise ValueError(f"Start node '{start_node_id}' was not found")

        adjacency: dict[str, list[str]] = defaultdict(list)
        for edge in self._active_edges(edges):
            if edge.source in node_map and edge.target in node_map:
                adjacency[edge.source].append(edge.target)

        seen: set[str] = set()
        stack = [start_node_id]
        while stack:
            current = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            stack.extend(adjacency[current])

        return [node for node in nodes if node.id in seen]

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
        if node.type == "loop":
            return "Running agent loop until goal"
        if node.type == "approval":
            return "Waiting for user approval"
        return "Running node"

    async def execute_stream(
        self, request: ExecuteWorkflowRequest
    ) -> AsyncIterator[dict[str, Any]]:
        workflow = request.workflow
        node_results: list[NodeExecutionResult] = []
        node_outputs: dict[str, str] = {}
        node_images: dict[str, list[str]] = {}
        original_input_text = ""
        final_output = ""
        run_id = run_registry.create_run(request.run_id or str(uuid.uuid4()))

        outer_nodes = self._outer_nodes(workflow.nodes)

        if request.start_node_id:
            try:
                outer_nodes = self._reachable_from(
                    request.start_node_id, outer_nodes, workflow.edges
                )
            except ValueError as exc:
                run_registry.discard(run_id)
                yield {"type": "failed", "error": str(exc)}
                return

        try:
            sorted_nodes = self._topological_sort(outer_nodes, workflow.edges)
        except ValueError as exc:
            run_registry.discard(run_id)
            yield {"type": "failed", "error": str(exc)}
            return

        try:
            yield {
                "type": "started",
                "runId": run_id,
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
                iteration_logs = None
                active_edges = self._active_edges(workflow.edges)

                if node.type == "input":
                    try:
                        runtime_input = (
                            request.input
                            if request.start_node_id is None
                            or node.id == request.start_node_id
                            else None
                        )
                        output = build_input_text(node, runtime_input)
                        if (
                            request.start_node_id is None
                            or node.id == request.start_node_id
                        ):
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
                    provider = getattr(node.data, "provider", None) or "ollama"
                    images = collect_upstream_images(
                        node.id,
                        workflow.nodes,
                        workflow.edges,
                        active_edges,
                        node_images,
                    )
                    enabled_tools = node.data.enabled_tools or []

                    try:
                        client = get_llm_client(provider, node.id)
                        if enabled_tools:
                            async for event in run_tool_loop(
                                client=client,
                                model=model,
                                system_message=node.data.system_prompt,
                                user_message=user_prompt,
                                images=images or None,
                                enabled_tools=enabled_tools,
                                max_tool_rounds=node.data.max_tool_rounds,
                                node_id=node.id,
                                forge_checkpoint=node.data.forge_checkpoint,
                            ):
                                if event["type"] == "tool_loop_completed":
                                    output = event.get("output", "") or ""
                                    generated = event.get("images") or []
                                    if generated:
                                        node_images[node.id] = list(generated)
                                        count = len(generated)
                                        suffix = (
                                            f"\n\n[{count} generated image"
                                            f"{'' if count == 1 else 's'} attached]"
                                        )
                                        if suffix.strip() not in output:
                                            output = (output + suffix).strip()
                                elif event["type"] in {
                                    "tool_started",
                                    "tool_completed",
                                    "tool_round",
                                }:
                                    yield event
                        else:
                            output = await client.chat(
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

                elif node.type == "loop":
                    loop_input = self._get_upstream_output(
                        node.id, workflow.edges, node_outputs
                    )
                    try:
                        async for event in self.loop_executor.execute_stream(
                            loop_node=node,
                            all_nodes=workflow.nodes,
                            all_edges=workflow.edges,
                            loop_input=loop_input,
                            original_input_text=original_input_text,
                        ):
                            yield event
                            if event["type"] == "loop_completed":
                                # Downstream / Final Output: passed result only.
                                # Stop reason, iterations, checker notes live in iterationLogs.
                                output = event.get("output", "")
                                iteration_logs = event.get("iterationLogs")
                            elif event["type"] == "node_failed":
                                yield {
                                    "type": "failed",
                                    "error": event.get("error", ""),
                                }
                                return
                    except Exception as exc:
                        yield {
                            "type": "node_failed",
                            "nodeId": node.id,
                            "error": str(exc),
                        }
                        yield {"type": "failed", "error": str(exc)}
                        return

                elif node.type == "approval":
                    content = self._get_upstream_output(
                        node.id, workflow.edges, node_outputs
                    )
                    run_registry.begin_approval_wait(run_id, node.id)
                    yield {
                        "type": "approval_required",
                        "runId": run_id,
                        "nodeId": node.id,
                        "nodeType": node.type,
                        "label": node.data.label,
                        "content": content,
                        "prompt": node.data.approval_prompt or "",
                    }
                    try:
                        decision = await run_registry.wait_for_decision(run_id)
                    except TimeoutError:
                        yield {
                            "type": "node_failed",
                            "nodeId": node.id,
                            "error": "Approval timed out",
                        }
                        yield {"type": "failed", "error": "Approval timed out"}
                        return
                    except asyncio.CancelledError:
                        yield {
                            "type": "cancelled",
                            "nodeId": node.id,
                            "error": "Run cancelled",
                        }
                        return

                    if decision.action == "cancel":
                        yield {
                            "type": "cancelled",
                            "nodeId": node.id,
                            "error": "Cancelled by user",
                        }
                        return

                    if decision.action == "edit":
                        output = (
                            decision.edited_content
                            if decision.edited_content is not None
                            else content
                        )
                    else:
                        output = content

                elif node.type == "output":
                    output = self._get_upstream_output(
                        node.id, workflow.edges, node_outputs
                    )
                    upstream_imgs = collect_upstream_images(
                        node.id,
                        workflow.nodes,
                        workflow.edges,
                        active_edges,
                        node_images,
                    )
                    if upstream_imgs:
                        node_images[node.id] = list(upstream_imgs)

                result_images = node_images.get(node.id)
                node_outputs[node.id] = output
                result = NodeExecutionResult(
                    nodeId=node.id,
                    nodeType=node.type,
                    output=output,
                    iterationLogs=iteration_logs,
                    images=result_images,
                )
                node_results.append(result)
                final_output = output

                completed_event: dict[str, Any] = {
                    "type": "node_completed",
                    "nodeId": node.id,
                    "nodeType": node.type,
                    "output": output,
                }
                if iteration_logs is not None:
                    completed_event["iterationLogs"] = iteration_logs
                if result_images:
                    completed_event["images"] = result_images
                yield completed_event

            yield {
                "type": "completed",
                "success": True,
                "nodeResults": [
                    result.model_dump(by_alias=True) for result in node_results
                ],
                "finalOutput": final_output,
            }
        finally:
            run_registry.discard(run_id)

    async def execute(self, request: ExecuteWorkflowRequest) -> ExecuteWorkflowResponse:
        if any(
            node.type == "approval" and not node.parent_id
            for node in request.workflow.nodes
        ):
            return ExecuteWorkflowResponse(
                success=False,
                node_results=[],
                final_output="",
                error="Approval nodes require streaming execution (/execute/stream)",
            )

        node_results: list[NodeExecutionResult] = []
        final_output = ""

        async for event in self.execute_stream(request):
            if event["type"] == "node_completed":
                node_results.append(
                    NodeExecutionResult(
                        nodeId=event["nodeId"],
                        nodeType=event["nodeType"],
                        output=event.get("output", ""),
                        iterationLogs=event.get("iterationLogs"),
                        images=event.get("images"),
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
            elif event["type"] == "cancelled":
                return ExecuteWorkflowResponse(
                    success=False,
                    node_results=node_results,
                    final_output="",
                    error=event.get("error") or "Cancelled by user",
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
