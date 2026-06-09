"""Convert LangGraph astream output into WebSocket events.

The graph streams dicts like `{node_name: state_update}`. For each node, we
emit a `reasoning` event (with a `step` derived from the node name and the
node's own AIMessage as content), plus any `warning` events for warnings
appended by that node. After the final `__end__` chunk, we emit the
`architecture` payload and a `complete` event.
"""
from __future__ import annotations

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
    "ask_validation_fixes": "asking_fixes",
    "self_correct": "self_correcting",
    "estimate": "estimating",
    "output": "complete",
}

DEFAULT_REASONING: Dict[str, str] = {
    "parse": "Analyzing requirements...",
    "request_clarification": "Requesting clarification from the user...",
    "query": "Querying Foundry IQ...",
    "reason": "Selecting Azure services...",
    "validate": "Validating architecture...",
    "ask_validation_fixes": "Reviewing validation results...",
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
) -> AgentState:
    """Run the graph, emitting WebSocket events for each node + final output."""
    graph = get_compiled_graph()
    final_state: AgentState = dict(initial_state)

    async for chunk in graph.astream(initial_state):
        for node_name, state_update in chunk.items():
            if node_name in ("__start__", "__end__"):
                if node_name == "__end__" and isinstance(state_update, dict):
                    final_state.update(state_update)
                continue

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

    # Chat Q&A path — emit text response only, no architecture event
    chat_answer = final_state.get("chat_answer_text")
    if chat_answer:
        await _maybe_await_sender(sender, {"type": "chat_response", "content": chat_answer})
        await _maybe_await_sender(sender, {"type": "complete"})
        return final_state

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
        return final_state

    pending_fixes = list(final_state.get("pending_validation_fixes") or [])
    if pending_fixes:
        await _maybe_await_sender(
            sender,
            {
                "type": "validation_fixes_needed",
                "fixes": pending_fixes,
            },
        )
        return final_state

    await _maybe_await_sender(sender, _build_architecture_event(final_state))

    summary = final_state.get("architecture_summary")
    if summary:
        await _maybe_await_sender(sender, {"type": "summary", "content": summary})

    await _maybe_await_sender(sender, {"type": "complete"})

    return final_state
