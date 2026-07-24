"""Prepare a workflow snapshot for community publish."""

from __future__ import annotations

import copy

from app.config import COMMUNITY_MAX_ATTACHMENT_CHARS
from app.schemas import WorkflowDefinition


def strip_large_attachments(workflow: WorkflowDefinition) -> WorkflowDefinition:
    """Drop oversized Start Point attachments to keep gallery posts lean."""
    snapshot = WorkflowDefinition.model_validate(
        copy.deepcopy(workflow.model_dump(by_alias=True))
    )
    for node in snapshot.nodes:
        attachments = node.data.attachments
        if not attachments:
            continue
        kept = []
        for attachment in attachments:
            if len(attachment.content or "") > COMMUNITY_MAX_ATTACHMENT_CHARS:
                continue
            kept.append(attachment)
        node.data.attachments = kept or None
    return snapshot
