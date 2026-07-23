import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Literal

ApprovalAction = Literal["approve", "edit", "cancel"]

APPROVAL_TIMEOUT_SECONDS = 30 * 60


@dataclass
class ApprovalDecision:
    action: ApprovalAction
    edited_content: str | None = None


@dataclass
class RunState:
    created_at: float = field(default_factory=time.monotonic)
    decision_future: asyncio.Future[ApprovalDecision] | None = None
    waiting_node_id: str | None = None


class RunRegistry:
    """In-memory registry for HITL approval decisions during a live SSE run."""

    def __init__(self) -> None:
        self._runs: dict[str, RunState] = {}

    def create_run(self, run_id: str | None = None) -> str:
        resolved = run_id or str(uuid.uuid4())
        self._runs[resolved] = RunState()
        return resolved

    def get(self, run_id: str) -> RunState | None:
        return self._runs.get(run_id)

    def discard(self, run_id: str) -> None:
        state = self._runs.pop(run_id, None)
        if state and state.decision_future and not state.decision_future.done():
            state.decision_future.cancel()

    def begin_approval_wait(self, run_id: str, node_id: str) -> None:
        """Register a pending Future before emitting approval_required."""
        state = self._runs.get(run_id)
        if state is None:
            raise RuntimeError(f"Unknown run: {run_id}")

        loop = asyncio.get_running_loop()
        if state.decision_future and not state.decision_future.done():
            state.decision_future.cancel()

        state.decision_future = loop.create_future()
        state.waiting_node_id = node_id

    async def wait_for_decision(self, run_id: str) -> ApprovalDecision:
        state = self._runs.get(run_id)
        if state is None or state.decision_future is None:
            raise RuntimeError(f"No pending approval for run: {run_id}")

        future = state.decision_future
        try:
            return await asyncio.wait_for(future, timeout=APPROVAL_TIMEOUT_SECONDS)
        except asyncio.TimeoutError as exc:
            raise TimeoutError("Approval timed out") from exc
        finally:
            if state.decision_future is future:
                state.decision_future = None
                state.waiting_node_id = None

    def submit_decision(
        self,
        run_id: str,
        action: ApprovalAction,
        edited_content: str | None = None,
    ) -> None:
        state = self._runs.get(run_id)
        if state is None:
            raise KeyError(f"Unknown run: {run_id}")
        if state.decision_future is None or state.decision_future.done():
            raise RuntimeError("No approval is currently waiting for this run")

        state.decision_future.set_result(
            ApprovalDecision(action=action, edited_content=edited_content)
        )


run_registry = RunRegistry()
