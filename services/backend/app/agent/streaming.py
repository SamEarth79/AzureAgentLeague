"""Convert LangGraph astream output into WebSocket events.

The graph streams dicts like `{node_name: state_update}`. For each node, we
emit a `reasoning` event (with a `step` derived from the node name and the
node's own AIMessage as content), plus any `warning` events for warnings
appended by that node. After the final `__end__` chunk, we emit the
`architecture` payload and a `complete` event.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional

from langchain_core.messages import AIMessage, BaseMessage

from ..models.domain import Architecture, Warning
from .graph import get_compiled_graph
from .state import AgentState

logger = logging.getLogger(__name__)

NODE_TO_STEP: Dict[str, str] = {
    "parse": "parsing",
    "request_clarification": "asking_clarification",
    "query": "querying",
    "reason": "reasoning",
    "validate": "validating",
    "self_correct": "self_correcting",
    "estimate": "estimating",
    "output": "complete",
}

# How long to pause BEFORE emitting each node's event (mock LLM "thinking" time)
NODE_DELAYS: Dict[str, float] = {
    "parse":                 1.5,
    "query":                 2.5,
    "reason":                3.0,
    "validate":              2.0,
    "self_correct":          2.0,
    "estimate":              2.0,
    "output":                1.0,
    "request_clarification": 1.0,
}

DEFAULT_REASONING: Dict[str, str] = {
    "parse": "Analyzing requirements...",
    "request_clarification": "Requesting clarification from the user...",
    "query": "Querying Foundry IQ...",
    "reason": "Selecting Azure services...",
    "validate": "Validating architecture...",
    "self_correct": "Applying fixes to the architecture...",
    "estimate": "Calculating cost and performance...",
    "output": "Finalizing architecture...",
}

Sender = Callable[[Dict[str, Any]], Awaitable[None]]


def _extract_latest_ai_content(messages: Optional[List[BaseMessage]]) -> Optional[str]:
    if not messages:
        return None
    for msg in reversed(messages):
        if isinstance(msg, AIMessage):
            content = msg.content
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                parts = []
                for part in content:
                    if isinstance(part, dict) and "text" in part:
                        parts.append(part["text"])
                    else:
                        parts.append(str(part))
                return " ".join(parts) if parts else None
    return None


def _warning_to_event(w: Warning) -> Dict[str, Any]:
    return {
        "type": "warning",
        "content": w.message,
        "severity": w.severity,
        "category": w.category,
    }


def _build_architecture_event(state: AgentState) -> Dict[str, Any]:
    arch = Architecture(
        services=list(state.get("selected_services") or []),
        connections=list(state.get("connections") or []),
        metadata=state.get("metadata"),
        warnings=list(state.get("warnings") or []),
    )
    return {"type": "architecture", "data": arch.model_dump(mode="json")}


async def _maybe_await_sender(
    sender: Optional[Sender],
    event: Dict[str, Any],
) -> None:
    if sender is None:
        return
    try:
        await sender(event)
    except Exception:
        logger.exception("sender raised; dropping event %s", event.get("type"))


async def stream_agent_events(
    initial_state: AgentState,
    sender: Optional[Sender] = None,
    *,
    step_delay: float = 0.0,
) -> AgentState:
    """Run the graph, emitting WebSocket events for each node + final output.

    Returns the final agent state. `sender` is an async callable that takes an
    event dict. `step_delay` adds a small pause between events for nicer UX.
    """
    graph = get_compiled_graph()
    final_state: AgentState = dict(initial_state)

    async for chunk in graph.astream(initial_state):
        for node_name, state_update in chunk.items():
            if node_name in ("__start__", "__end__"):
                if node_name == "__end__" and isinstance(state_update, dict):
                    final_state.update(state_update)
                continue

            delay = NODE_DELAYS.get(node_name, step_delay)
            if delay > 0:
                await asyncio.sleep(delay)

            step = NODE_TO_STEP.get(node_name, node_name)
            content = _extract_latest_ai_content(state_update.get("messages"))
            if not content:
                content = DEFAULT_REASONING.get(node_name, f"Running {node_name}...")

            await _maybe_await_sender(
                sender,
                {"type": "reasoning", "content": content, "step": step},
            )

            new_warnings = state_update.get("warnings") or []
            for w in new_warnings:
                await _maybe_await_sender(sender, _warning_to_event(w))

    pending = list(final_state.get("pending_clarifications") or [])
    if pending:
        await _maybe_await_sender(
            sender,
            {
                "type": "clarification_needed",
                "questions": pending,
                "missing_fields": list(final_state.get("pending_missing_fields") or []),
            },
        )
    else:
        await _maybe_await_sender(sender, _build_architecture_event(final_state))
        await _maybe_await_sender(sender, {"type": "complete"})

    return final_state
