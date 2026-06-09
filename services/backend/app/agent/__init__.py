"""ArchMind agent package.

Exports `run_agent()` — the entry point called by the WebSocket handler.
Runs the LangGraph state machine and streams events back to the client.
"""
from __future__ import annotations

import logging
from typing import Any, Awaitable, Callable, Dict, List, Optional

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from ..models.domain import Architecture
from .state import AgentState
from .streaming import stream_agent_events

logger = logging.getLogger(__name__)

Sender = Callable[[Dict[str, Any]], Awaitable[None]]


def _history_to_messages(history: List[Dict[str, Any]]) -> List[BaseMessage]:
    msgs: List[BaseMessage] = []
    for entry in history or []:
        role = entry.get("role")
        content = entry.get("content", "")
        if role == "user":
            msgs.append(HumanMessage(content=content))
        elif role == "assistant":
            msgs.append(AIMessage(content=content))
        elif role == "system":
            from langchain_core.messages import SystemMessage
            msgs.append(SystemMessage(content=content))
    return msgs


async def run_agent(
    session_id: str,
    user_message: str,
    message_history: List[Dict[str, Any]],
    websocket_sender: Sender,
    existing_architecture: Optional[Architecture] = None,
    *,
    is_clarification_response: bool = False,
    original_prompt: Optional[str] = None,
    is_validation_response: bool = False,
    validation_fix_choices: Optional[Dict[str, bool]] = None,
    step_delay: float = 0.2,
) -> AgentState:
    """Run the ArchMind agent for one user turn.

    Parameters
    ----------
    session_id : str
        UUID of the active session.
    user_message : str
        The new user input to reason about.
    message_history : list[dict]
        Prior conversation in {"role": ..., "content": ...} form.
    websocket_sender : async callable
        Receives WebSocket event dicts as the graph runs.
    existing_architecture : Architecture, optional
        Current architecture on the canvas, if any. When provided, the
        agent treats the user message as a refinement request.
    is_clarification_response : bool
        True when this message is the user's answer to a previous
        clarification request. The parse node will merge it with
        `original_prompt` before re-detecting intent.
    original_prompt : str, optional
        The user's original request before clarification was requested.
        Used to merge the answer back into a complete requirements set.
    is_validation_response : bool
        True when this message is the user's answer to a previous
        validation fixes request. The self_correct node will apply
        only the fixes the user approved.
    validation_fix_choices : dict, optional
        Mapping of fix category → bool (True=apply fix, False=skip).
    step_delay : float
        Seconds to pause between events for nicer streaming UX.

    Returns
    -------
    AgentState
        Final state after the graph completes (includes selected_services,
        connections, metadata, warnings, etc.).
    """
    initial_state: AgentState = {
        "session_id": session_id,
        "user_message": user_message,
            "messages": _history_to_messages(message_history),
            "iteration": 0,
            "validation_passed": False,
            "needs_clarification": False,
            "is_refinement": existing_architecture is not None,
            "existing_architecture": existing_architecture,
            "warnings": [],
            "pending_clarifications": [],
            "pending_missing_fields": [],
            "is_clarification_response": is_clarification_response,
            "original_prompt": original_prompt,
            "pending_validation_fixes": [],
            "is_validation_response": is_validation_response,
            "validation_fix_choices": validation_fix_choices or {},
        }

    logger.info(
        "run_agent start: session=%s, refinement=%s, msg_len=%d",
        session_id,
        initial_state["is_refinement"],
        len(user_message),
    )

    final_state = await stream_agent_events(
        initial_state,
        sender=websocket_sender,
        step_delay=step_delay,
    )

    logger.info(
        "run_agent done: session=%s, services=%d, warnings=%d, iterations=%d",
        session_id,
        len(final_state.get("selected_services") or []),
        len(final_state.get("warnings") or []),
        int(final_state.get("iteration", 0)),
    )
    return final_state


__all__ = ["run_agent", "AgentState", "Sender"]
