"""Build the LangGraph state machine for the ArchMind reasoning agent.

Flow:
    parse -> (request_clarification | query) -> query -> reason -> validate ->
    (self_correct | estimate) -> self_correct -> (validate | estimate) ->
    estimate -> output -> END

    request_clarification -> END  (graph pauses; user message triggers new run)
"""
from __future__ import annotations

from langgraph.graph import END, StateGraph

from .nodes import (
    estimate_cost_performance_node,
    generate_output_node,
    parse_requirements_node,
    query_foundry_iq_node,
    reason_and_select_node,
    request_clarification_node,
    self_correct_node,
    validate_architecture_node,
)
from .state import AgentState

MAX_SELF_CORRECTIONS = 3


def _route_after_parse(state: AgentState) -> str:
    return "request_clarification" if state.get("needs_clarification") else "query"


def _route_after_validate(state: AgentState) -> str:
    return "estimate" if state.get("validation_passed") else "self_correct"


def _route_after_self_correct(state: AgentState) -> str:
    iteration = int(state.get("iteration", 0))
    validation_passed = bool(state.get("validation_passed"))
    if (not validation_passed) and iteration < MAX_SELF_CORRECTIONS:
        return "validate"
    return "estimate"


def build_graph() -> StateGraph:
    g = StateGraph(AgentState)

    g.add_node("parse", parse_requirements_node)
    g.add_node("request_clarification", request_clarification_node)
    g.add_node("query", query_foundry_iq_node)
    g.add_node("reason", reason_and_select_node)
    g.add_node("validate", validate_architecture_node)
    g.add_node("self_correct", self_correct_node)
    g.add_node("estimate", estimate_cost_performance_node)
    g.add_node("output", generate_output_node)

    g.set_entry_point("parse")
    g.add_conditional_edges(
        "parse",
        _route_after_parse,
        {"request_clarification": "request_clarification", "query": "query"},
    )
    g.add_edge("request_clarification", END)
    g.add_edge("query", "reason")
    g.add_edge("reason", "validate")
    g.add_conditional_edges(
        "validate",
        _route_after_validate,
        {"self_correct": "self_correct", "estimate": "estimate"},
    )
    g.add_conditional_edges(
        "self_correct",
        _route_after_self_correct,
        {"validate": "validate", "estimate": "estimate"},
    )
    g.add_edge("estimate", "output")
    g.add_edge("output", END)

    return g


_compiled_graph = None


def get_compiled_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = build_graph().compile()
    return _compiled_graph
