from collections.abc import AsyncIterator
from typing import Any

from app.schemas import WorkflowNode
from app.services.input_content import (
    build_llm_user_prompt,
    collect_upstream_images,
    get_upstream_source,
)
from app.services.ollama import OllamaService
from app.services.tool_loop import run_tool_loop


CHECKER_SYSTEM_PROMPT = (
    "You decide whether a workflow goal is satisfied. "
    "Respond with DONE or CONTINUE on the first line, then one short reason line."
)


def _active_edges(edges: list) -> list:
    return [edge for edge in edges if not getattr(edge, "disabled", False)]


def _topological_sort(
    nodes: list[WorkflowNode], edges: list
) -> list[WorkflowNode]:
    from collections import defaultdict, deque

    node_map = {node.id: node for node in nodes}
    in_degree: dict[str, int] = {node.id: 0 for node in nodes}
    adjacency: dict[str, list[str]] = defaultdict(list)

    for edge in _active_edges(edges):
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
        raise ValueError("Loop body contains a cycle or disconnected nodes")

    return [node_map[node_id] for node_id in sorted_ids]


def _get_upstream_output(
    node_id: str, edges: list, node_outputs: dict[str, str]
) -> str:
    for edge in _active_edges(edges):
        if edge.target == node_id and edge.source in node_outputs:
            return node_outputs[edge.source]
    return ""


def _is_done_marker(text: str) -> bool:
    first_line = text.strip().splitlines()[0].strip().upper() if text.strip() else ""
    return first_line.startswith("DONE")


def _build_iteration_prompt(
    *,
    iteration: int,
    max_iterations: int,
    loop_input: str,
    previous_output: str,
    upstream_output: str,
    upstream_type: str | None,
) -> str:
    sections = [
        f"## Iteration {iteration} of {max_iterations}",
        "## Loop Input",
        loop_input or "(empty)",
    ]

    if previous_output and previous_output != loop_input:
        sections.extend(["## Previous Iteration Output", previous_output])

    if upstream_output:
        sections.extend(["## Previous Step Output", upstream_output])
    elif upstream_type == "input":
        sections.extend(["## Previous Step Output", loop_input or "(empty)"])

    return "\n\n".join(sections)


class LoopExecutor:
    def __init__(self, ollama_service: OllamaService | None = None) -> None:
        self.ollama = ollama_service or OllamaService()

    async def execute_stream(
        self,
        *,
        loop_node: WorkflowNode,
        all_nodes: list[WorkflowNode],
        all_edges: list,
        loop_input: str,
        original_input_text: str,
    ) -> AsyncIterator[dict[str, Any]]:
        child_nodes = [node for node in all_nodes if node.parent_id == loop_node.id]
        if not child_nodes:
            raise ValueError("Agent Loop has no inner nodes")

        child_ids = {node.id for node in child_nodes}
        inner_edges = [
            edge
            for edge in _active_edges(all_edges)
            if edge.source in child_ids and edge.target in child_ids
        ]

        sorted_inner = _topological_sort(child_nodes, inner_edges)
        goal = (loop_node.data.goal_prompt or "The task is complete.").strip()
        max_iterations = max(1, min(loop_node.data.max_iterations or 5, 20))
        checker_model = loop_node.data.checker_model
        default_model = sorted_inner[0].data.model or "gemma4:e4b"
        checker_model = checker_model or default_model

        yield {
            "type": "loop_started",
            "nodeId": loop_node.id,
            "label": loop_node.data.label,
            "maxIterations": max_iterations,
            "message": "Refining until goal…",
        }

        last_output = loop_input
        previous_output = loop_input
        stop_reason = "Max iterations reached"
        completed_iterations = 0

        for iteration in range(1, max_iterations + 1):
            completed_iterations = iteration
            yield {
                "type": "loop_iteration",
                "nodeId": loop_node.id,
                "iteration": iteration,
                "maxIterations": max_iterations,
                "message": f"Iteration {iteration}/{max_iterations}",
            }

            iteration_outputs: dict[str, str] = {}

            for inner_node in sorted_inner:
                yield {
                    "type": "node_started",
                    "nodeId": inner_node.id,
                    "nodeType": inner_node.type,
                    "label": inner_node.data.label,
                    "message": f"Iteration {iteration}/{max_iterations} · Calling Ollama ({inner_node.data.model or default_model})",
                    "loopId": loop_node.id,
                    "iteration": iteration,
                }

                output = ""

                if inner_node.type == "llm":
                    upstream_output = _get_upstream_output(
                        inner_node.id, inner_edges, iteration_outputs
                    )
                    upstream_source = get_upstream_source(
                        inner_node.id, child_nodes, inner_edges
                    )
                    user_prompt = _build_iteration_prompt(
                        iteration=iteration,
                        max_iterations=max_iterations,
                        loop_input=loop_input,
                        previous_output=previous_output,
                        upstream_output=upstream_output,
                        upstream_type=upstream_source.type
                        if upstream_source
                        else None,
                    )
                    if not upstream_output and iteration == 1:
                        user_prompt = build_llm_user_prompt(
                            original_input_text or loop_input,
                            loop_input,
                            "input",
                        )
                        user_prompt = (
                            f"## Iteration {iteration} of {max_iterations}\n\n{user_prompt}"
                        )

                    images = collect_upstream_images(
                        inner_node.id,
                        all_nodes,
                        all_edges,
                        _active_edges(all_edges),
                    )

                    enabled_tools = inner_node.data.enabled_tools or []
                    if enabled_tools:
                        async for event in run_tool_loop(
                            ollama=self.ollama,
                            model=inner_node.data.model or default_model,
                            system_message=inner_node.data.system_prompt,
                            user_message=user_prompt,
                            images=images or None,
                            enabled_tools=enabled_tools,
                            max_tool_rounds=inner_node.data.max_tool_rounds,
                            node_id=inner_node.id,
                        ):
                            if event["type"] == "tool_loop_completed":
                                output = event.get("output", "")
                            elif event["type"] in {
                                "tool_started",
                                "tool_completed",
                                "tool_round",
                            }:
                                yield {
                                    **event,
                                    "loopId": loop_node.id,
                                    "iteration": iteration,
                                }
                    else:
                        output = await self.ollama.chat(
                            model=inner_node.data.model or default_model,
                            user_message=user_prompt,
                            system_message=inner_node.data.system_prompt,
                            images=images or None,
                        )
                else:
                    raise ValueError(
                        f"Unsupported node type inside loop: {inner_node.type}"
                    )

                iteration_outputs[inner_node.id] = output
                last_output = output

                yield {
                    "type": "node_completed",
                    "nodeId": inner_node.id,
                    "nodeType": inner_node.type,
                    "output": output,
                    "loopId": loop_node.id,
                    "iteration": iteration,
                }

            if _is_done_marker(last_output):
                stop_reason = "Goal met (checker node)"
                break

            checker_output = await self.ollama.chat(
                model=checker_model,
                user_message=(
                    f"Goal:\n{goal}\n\nCurrent output:\n{last_output}\n\n"
                    "Respond with DONE or CONTINUE on the first line."
                ),
                system_message=CHECKER_SYSTEM_PROMPT,
            )

            if _is_done_marker(checker_output):
                stop_reason = checker_output.strip().splitlines()[0].strip()
                break

            previous_output = last_output

        yield {
            "type": "loop_completed",
            "nodeId": loop_node.id,
            "iterations": completed_iterations,
            "maxIterations": max_iterations,
            "reason": stop_reason,
            "output": last_output,
        }
