from app.services.document_extractor import extract_document_text
from app.schemas import WorkflowNode


def build_input_text(
    node: WorkflowNode,
    runtime_input: str | None = None,
) -> str:
    parts: list[str] = []

    primary = runtime_input if runtime_input is not None else node.data.value
    if primary:
        parts.append(primary)

    for attachment in node.data.attachments or []:
        if attachment.kind == "text":
            parts.append(f"\n\n--- {attachment.name} ---\n{attachment.content}")
        elif attachment.kind == "document":
            extracted = extract_document_text(attachment.name, attachment.content)
            parts.append(f"\n\n--- {attachment.name} ---\n{extracted}")

    return "\n".join(parts).strip()


def collect_upstream_images(
    node_id: str,
    nodes: list[WorkflowNode],
    edges: list,
    active_edges: list,
) -> list[str]:
    node_map = {node.id: node for node in nodes}

    for edge in active_edges:
        if edge.target != node_id:
            continue

        source = node_map.get(edge.source)
        if source is None:
            continue

        if source.type == "input":
            return [
                attachment.content
                for attachment in source.data.attachments or []
                if attachment.kind == "image"
            ]

        if source.type in {"llm", "approval", "loop"}:
            return collect_upstream_images(source.id, nodes, edges, active_edges)

    return []


def get_upstream_source(
    node_id: str,
    nodes: list[WorkflowNode],
    active_edges: list,
) -> WorkflowNode | None:
    node_map = {node.id: node for node in nodes}

    for edge in active_edges:
        if edge.target != node_id:
            continue
        source = node_map.get(edge.source)
        if source is not None:
            return source

    return None


def build_llm_user_prompt(
    original_input: str,
    upstream_output: str,
    upstream_type: str | None,
) -> str:
    if not upstream_output and not original_input:
        return "Please analyze the attached input."

    if upstream_type == "input":
        return upstream_output or original_input

    parts: list[str] = []
    if original_input:
        parts.append(f"## Original Input\n{original_input}")
    if upstream_output:
        parts.append(f"## Previous Step Output\n{upstream_output}")

    return "\n\n".join(parts).strip()
