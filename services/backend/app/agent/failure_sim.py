"""Failure cascade simulation — pure computation, no LangGraph needed.

Given an architecture and a failed service ID, performs a BFS from the failed
node along the connection graph to determine downstream impact. Edge type
determines impact severity:
  sync         → direct_failure  (synchronous dependency, fails immediately)
  async        → degraded        (queued, drains and eventually fails)
  event-driven → delayed_impact  (events stop flowing, delayed cascade)
"""
from __future__ import annotations

from collections import deque
from typing import Any, Dict, List, Optional

from ..models.domain import Architecture


_IMPACT_BY_CONN_TYPE = {
    "sync": "direct_failure",
    "async": "degraded",
    "event-driven": "delayed_impact",
}

_SEVERITY_ORDER = ["direct_failure", "degraded", "delayed_impact"]


def simulate_failure(architecture: Architecture, failed_service_id: str) -> Optional[Dict[str, Any]]:
    """Return a failure simulation result dict, or None if the service is not found."""
    service_map = {s.id: s for s in architecture.services}
    if failed_service_id not in service_map:
        return None

    # Build adjacency: source_id → [(target_id, conn_type)]
    adj: Dict[str, List[tuple]] = {s.id: [] for s in architecture.services}
    for conn in architecture.connections:
        if conn.source_id in adj:
            adj[conn.source_id].append((conn.target_id, conn.type))

    # BFS from failed node
    visited: Dict[str, str] = {}  # service_id → impact level
    queue: deque = deque()

    for target_id, conn_type in adj.get(failed_service_id, []):
        if target_id != failed_service_id and target_id in service_map:
            impact = _IMPACT_BY_CONN_TYPE.get(conn_type, "direct_failure")
            queue.append((target_id, impact))

    while queue:
        svc_id, impact = queue.popleft()
        if svc_id in visited:
            # Keep the worst impact seen
            existing = visited[svc_id]
            if _SEVERITY_ORDER.index(impact) < _SEVERITY_ORDER.index(existing):
                visited[svc_id] = impact
            continue
        visited[svc_id] = impact
        # Propagate further — downstream of a failed node also fails (one step worse)
        for target_id, conn_type in adj.get(svc_id, []):
            if target_id not in visited and target_id != failed_service_id and target_id in service_map:
                # Downstream of a degraded service degrades further
                next_impact = _propagate_impact(impact, conn_type)
                queue.append((target_id, next_impact))

    impacted = [
        {
            "id": svc_id,
            "name": service_map[svc_id].name,
            "severity": impact_level,
            "reason": _reason(impact_level, service_map[failed_service_id].name),
        }
        for svc_id, impact_level in visited.items()
    ]

    total = len(architecture.services)
    affected = len(impacted) + 1  # +1 for the failed service itself
    unaffected_count = total - affected

    if any(i["severity"] == "direct_failure" for i in impacted) or affected == total:
        overall_status = "full_outage" if affected >= total * 0.7 else "partial_outage"
    else:
        overall_status = "degraded"

    direct = sum(1 for i in impacted if i["severity"] == "direct_failure")
    deg = sum(1 for i in impacted if i["severity"] == "degraded")
    delayed = sum(1 for i in impacted if i["severity"] == "delayed_impact")

    parts = []
    if direct:
        parts.append(f"{direct} service{'s' if direct > 1 else ''} fail immediately")
    if deg:
        parts.append(f"{deg} degraded")
    if delayed:
        parts.append(f"{delayed} delayed cascade")
    summary = ", ".join(parts) if parts else "No downstream impact detected"

    return {
        "failed_service_id": failed_service_id,
        "failed_service_name": service_map[failed_service_id].name,
        "impacted": impacted,
        "unaffected_count": unaffected_count,
        "overall_status": overall_status,
        "summary": summary,
    }


def _propagate_impact(upstream_impact: str, conn_type: str) -> str:
    base = _IMPACT_BY_CONN_TYPE.get(conn_type, "direct_failure")
    # Take the less severe of upstream impact propagated vs edge type
    upstream_idx = _SEVERITY_ORDER.index(upstream_impact)
    base_idx = _SEVERITY_ORDER.index(base)
    return _SEVERITY_ORDER[max(upstream_idx, base_idx)]


def _reason(severity: str, failed_name: str) -> str:
    if severity == "direct_failure":
        return f"Synchronously depends on {failed_name} — fails immediately"
    if severity == "degraded":
        return f"Async queue from {failed_name} drains — degrades over time"
    return f"Event flow from {failed_name} stops — delayed cascade"
