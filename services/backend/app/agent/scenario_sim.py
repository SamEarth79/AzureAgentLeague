import json
import logging
import re
from typing import Any, Dict, List, Optional

from ..models.domain import Architecture
from .tools import call_deepseek, query_foundry_iq

logger = logging.getLogger(__name__)

# Known scenario labels (fuzzy-matched by normalizing input)
_SCENARIOS: Dict[str, str] = {
    "ddos": "DDoS Attack",
    "dos": "DDoS Attack",
    "rush hour": "Traffic Spike (10x normal load)",
    "rush_hour": "Traffic Spike (10x normal load)",
    "traffic spike": "Traffic Spike (10x normal load)",
    "spike": "Traffic Spike (10x normal load)",
    "load": "Traffic Spike (10x normal load)",
    "region failure": "Azure Region Failure",
    "region_failure": "Azure Region Failure",
    "region outage": "Azure Region Failure",
    "data breach": "Security Breach / Data Exfiltration",
    "data_breach": "Security Breach / Data Exfiltration",
    "breach": "Security Breach / Data Exfiltration",
    "scale": "Autoscale Stress Test",
    "autoscale": "Autoscale Stress Test",
    "slow query": "Database Slow-Query Degradation",
    "db failure": "Database Failure",
    "database failure": "Database Failure",
    "network partition": "Network Partition",
    "partition": "Network Partition",
}

_SEVERITY_ORDER = ["failed", "direct_failure", "degraded", "delayed_impact", "unaffected"]


def _normalize(scenario: str) -> str:
    return scenario.lower().strip().replace("-", " ").replace("_", " ")


def _resolve_label(scenario: str) -> str:
    normalized = _normalize(scenario)
    if normalized in _SCENARIOS:
        return _SCENARIOS[normalized]
    # partial match
    for key, label in _SCENARIOS.items():
        if key in normalized or normalized in key:
            return label
    return scenario.title()


def _parse_impact_map(response: str) -> List[Dict[str, str]]:
    """Extract impact_map JSON array from LLM response."""
    # Try fenced JSON block first
    m = re.search(r"```json\s*(\{.*?\})\s*```", response, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(1))
            return data.get("impact_map", [])
        except json.JSONDecodeError:
            pass
    # Try bare JSON object
    m = re.search(r'\{"impact_map"\s*:\s*\[.*?\]\s*\}', response, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(0))
            return data.get("impact_map", [])
        except json.JSONDecodeError:
            pass
    return []


def _build_failure_map(impact_entries: List[Dict], architecture: Architecture, scenario_label: str) -> Dict[str, Any]:
    """Convert LLM impact_map list into a FailureSimResult-compatible dict."""
    service_map = {s.id: s for s in architecture.services}

    # Find the "failed" service (highest severity)
    failed_entry = None
    impacted = []

    for entry in impact_entries:
        svc_id = entry.get("id", "")
        severity = entry.get("severity", "unaffected")
        if svc_id not in service_map:
            continue
        if severity == "failed" and failed_entry is None:
            failed_entry = entry
        elif severity != "unaffected":
            impacted.append({
                "id": svc_id,
                "name": service_map[svc_id].name,
                "severity": severity,
                "reason": entry.get("reason", ""),
            })

    # If no explicit "failed" service, pick the most critical
    if not failed_entry and impacted:
        worst = min(impacted, key=lambda e: _SEVERITY_ORDER.index(e["severity"]) if e["severity"] in _SEVERITY_ORDER else 99)
        failed_entry = {"id": worst["id"], "severity": worst["severity"], "reason": worst["reason"]}
        impacted = [e for e in impacted if e["id"] != worst["id"]]

    failed_service_id = failed_entry["id"] if failed_entry else (architecture.services[0].id if architecture.services else "")
    failed_service_name = service_map[failed_service_id].name if failed_service_id in service_map else "Unknown"

    unaffected_count = len([
        e for e in impact_entries
        if e.get("severity") == "unaffected" and e.get("id") in service_map
    ])

    # Derive overall_status from worst severity among impacted
    severities = [e["severity"] for e in impacted]
    if "failed" in severities or "direct_failure" in severities:
        overall_status = "full_outage"
    elif "degraded" in severities:
        overall_status = "partial_outage"
    elif "delayed_impact" in severities:
        overall_status = "degraded"
    else:
        overall_status = "degraded"

    return {
        "failed_service_id": failed_service_id,
        "failed_service_name": failed_service_name,
        "impacted": impacted,
        "unaffected_count": unaffected_count,
        "overall_status": overall_status,
        "summary": f"Scenario: {scenario_label}",
    }


_SYSTEM_PROMPT = """You are an Azure architecture resilience expert. A user has provided their architecture and wants to simulate a specific scenario.

Reason through:
1. **Entry Point** — Which service(s) are the first point of stress or attack under this scenario?
2. **Cascade Effects** — How does failure or degradation propagate through the architecture?
3. **Existing Mitigations** — What defenses are already in place in the architecture?
4. **Missing Defenses** — What specific Azure services, configs, or patterns would harden this architecture?
5. **Verdict** — End with one of: **RESILIENT** / **DEGRADED** / **CRITICAL**

Use ## headings. Reference specific service names from the architecture. Be concise and actionable.

At the very end of your response, output EXACTLY this JSON block (no other JSON):
```json
{"impact_map": [{"id": "<exact service id>", "severity": "failed|direct_failure|degraded|delayed_impact|unaffected", "reason": "<one sentence>"}]}
```
Include every service from the architecture in the impact_map."""


async def simulate_scenario(
    architecture: Architecture,
    scenario: str,
    session_id: str,
) -> Dict[str, Any]:
    """Run LLM-powered scenario simulation against the current architecture."""
    scenario_label = _resolve_label(scenario)

    # Query IQ for relevant resilience patterns
    iq_context = ""
    try:
        iq_context = await query_foundry_iq(f"{scenario} resilience Azure architecture patterns")
    except Exception:
        logger.warning("IQ query failed for scenario simulation, continuing without it")

    # Build architecture summary for prompt
    services_text = "\n".join(
        f"- id={s.id} name={s.name} type={s.type}"
        + (f" region={s.region}" if s.region else "")
        + (f" config={s.config}" if s.config else "")
        for s in architecture.services
    )
    connections_text = "\n".join(
        f"- {c.source_id} → {c.target_id} ({c.type})"
        for c in architecture.connections
    )

    user_prompt = f"""## Scenario: {scenario_label}

## Architecture Services
{services_text}

## Connections
{connections_text}
"""

    if iq_context:
        user_prompt += f"\n## Azure Best Practices (from Foundry IQ)\n{iq_context}\n"

    user_prompt += "\nAnalyze how this architecture holds up under the scenario above."

    response = await call_deepseek(
        _SYSTEM_PROMPT,
        user_prompt,
        session_id=session_id,
        update_history=True,
    )

    if not response:
        return {
            "reasoning": f"Unable to simulate scenario '{scenario_label}' — LLM returned empty response.",
            "failure_map": None,
        }

    # Strip the JSON block from reasoning text shown to user
    reasoning_text = re.sub(r"```json\s*\{.*?\}\s*```", "", response, flags=re.DOTALL).strip()

    impact_entries = _parse_impact_map(response)
    failure_map: Optional[Dict[str, Any]] = None
    if impact_entries:
        try:
            failure_map = _build_failure_map(impact_entries, architecture, scenario_label)
        except Exception:
            logger.warning("Could not build failure map from impact entries", exc_info=True)

    return {
        "reasoning": reasoning_text,
        "failure_map": failure_map,
    }
