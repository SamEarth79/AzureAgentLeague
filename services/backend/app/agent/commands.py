import json
import logging
import re
from typing import Any, Dict, Optional

from ..models.domain import Architecture, Service, Connection, ArchitectureMetadata
from .tools import call_deepseek, query_foundry_iq

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _arch_summary(architecture: Architecture) -> str:
    services_text = "\n".join(
        f"- id={s.id} name={s.name} type={s.type}"
        + (f" region={s.region}" if s.region else "")
        + (f" cost=${s.cost_estimate}/mo" if s.cost_estimate is not None else "")
        + (f" reasoning={s.reasoning}" if s.reasoning else "")
        for s in architecture.services
    )
    connections_text = "\n".join(
        f"- {c.source_id} → {c.target_id} ({c.type})"
        for c in architecture.connections
    )
    meta = architecture.metadata
    meta_text = ""
    if meta:
        meta_text = (
            f"\nEstimated cost: ${meta.estimated_cost_monthly}/mo"
            f"\nP95 latency: {meta.estimated_latency_p95}"
            f"\nThroughput: {meta.estimated_throughput}"
        )
    return f"## Services\n{services_text}\n\n## Connections\n{connections_text}{meta_text}"


def _parse_json_block(text: str) -> Optional[Dict]:
    """Extract the first ```json ... ``` block from LLM output."""
    m = re.search(r"```json\s*(\{.*?\}|\[.*?\])\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    # Fallback: bare JSON object
    m = re.search(r"(\{[\s\S]*\})", text)
    if m:
        try:
            return json.loads(m.group(1))
        except json.JSONDecodeError:
            pass
    return None


# ---------------------------------------------------------------------------
# /optimize
# ---------------------------------------------------------------------------

_OPTIMIZE_GOALS = {
    "cost":        "Minimize total monthly cost while preserving the core functionality.",
    "latency":     "Minimize request latency and p95 response time.",
    "reliability": "Maximize availability, eliminate single points of failure, add redundancy.",
    "security":    "Harden the architecture against threats — secrets management, network isolation, least-privilege.",
    "scalability": "Make the architecture scale horizontally to handle 10x traffic without re-architecting.",
}

_OPTIMIZE_SYSTEM = """You are an Azure architecture optimization expert.

Given an architecture and an optimization goal, reason through:
1. **What to change** — which services to swap, add, remove, or reconfigure
2. **Why** — the tradeoff being made (what is gained vs. what is sacrificed)
3. **How much it helps** — quantify where possible (cost %, latency ms, SLA %)

Then output the FULL modified architecture as a JSON block.

The JSON must follow this exact shape:
```json
{
  "services": [
    {"id": "<keep original id if unchanged, or new uuid>", "name": "...", "type": "...", "region": "eastus", "reasoning": "...", "cost_estimate": 0.0, "config": {}}
  ],
  "connections": [
    {"id": "conn-...", "source_id": "...", "target_id": "...", "type": "sync|async|event-driven"}
  ],
  "metadata": {
    "estimated_cost_monthly": 0.0,
    "estimated_latency_p95": "...",
    "estimated_throughput": "...",
    "regions": ["eastus"]
  }
}
```

IMPORTANT: Preserve service IDs for unchanged services. Only generate new UUIDs for truly new services.
Put all your reasoning BEFORE the JSON block. Do not include the JSON block in the middle of your explanation."""


async def optimize_architecture(
    architecture: Architecture,
    goal: str,
    session_id: str,
) -> Dict[str, Any]:
    goal_key = goal.lower().strip().replace("-", "_").replace(" ", "_")
    goal_description = _OPTIMIZE_GOALS.get(goal_key, f"Optimize for {goal}.")

    iq_context = ""
    try:
        iq_context = await query_foundry_iq(f"Azure architecture optimization {goal} best practices")
    except Exception:
        logger.warning("IQ query failed for optimize, continuing without")

    user_prompt = f"## Optimization Goal\n{goal_description}\n\n{_arch_summary(architecture)}"
    if iq_context:
        user_prompt += f"\n\n## Azure Best Practices (Foundry IQ)\n{iq_context}"
    user_prompt += "\n\nReason through the optimizations, then output the modified architecture JSON."

    response = await call_deepseek(
        _OPTIMIZE_SYSTEM, user_prompt, session_id=session_id, update_history=True
    )

    if not response:
        return {"reasoning": "Optimization failed — no response from LLM.", "architecture": None}

    arch_data = _parse_json_block(response)
    # Strip all fenced code blocks (json or plain) from the reasoning shown to the user
    reasoning_text = re.sub(r"```(?:json)?\s*[\s\S]*?```", "", response, flags=re.DOTALL).strip()

    new_arch: Optional[Architecture] = None
    if arch_data and "services" in arch_data:
        try:
            services = [Service(**s) for s in arch_data.get("services", [])]
            connections = [Connection(**c) for c in arch_data.get("connections", [])]
            meta_raw = arch_data.get("metadata", {})
            metadata = ArchitectureMetadata(**meta_raw) if meta_raw else architecture.metadata
            new_arch = Architecture(
                services=services,
                connections=connections,
                metadata=metadata,
                warnings=[],
            )
        except Exception:
            logger.warning("Could not parse optimized architecture from LLM output", exc_info=True)

    return {"reasoning": reasoning_text, "architecture": new_arch}


# ---------------------------------------------------------------------------
# /audit
# ---------------------------------------------------------------------------

_AUDIT_SYSTEM = """You are an Azure security and compliance architect.

Audit the given architecture across these dimensions:
1. **Identity & Access** — RBAC, managed identities, least-privilege
2. **Network Security** — VNet integration, private endpoints, NSGs, WAF
3. **Data Protection** — encryption at rest/transit, key management (Key Vault)
4. **Secrets & Config** — no hardcoded secrets, Key Vault references
5. **Monitoring & Threat Detection** — Microsoft Defender, Sentinel, audit logs
6. **Compliance Gaps** — GDPR, SOC2, ISO27001 relevant controls

For each dimension:
- ✅ if the architecture already handles it
- ⚠️ if partial
- ❌ if missing

End with a **Risk Score**: LOW / MEDIUM / HIGH / CRITICAL and a prioritized fix list.

Use ## headings. Be specific about service names and Azure-native solutions."""


async def audit_architecture(
    architecture: Architecture,
    session_id: str,
) -> Dict[str, Any]:
    iq_context = ""
    try:
        iq_context = await query_foundry_iq("Azure security compliance architecture best practices GDPR SOC2")
    except Exception:
        logger.warning("IQ query failed for audit, continuing without")

    user_prompt = _arch_summary(architecture)
    if iq_context:
        user_prompt += f"\n\n## Azure Security Best Practices (Foundry IQ)\n{iq_context}"
    user_prompt += "\n\nAudit this architecture for security and compliance gaps."

    response = await call_deepseek(
        _AUDIT_SYSTEM, user_prompt, session_id=session_id, update_history=True
    )

    return {"reasoning": response or "Audit failed — no response from LLM."}


# ---------------------------------------------------------------------------
# /explain
# ---------------------------------------------------------------------------

_AUDIENCE_CONTEXTS = {
    "cto": (
        "a Chief Technology Officer",
        "Focus on: strategic fit, scalability ceiling, operational risk, team skill requirements, "
        "vendor lock-in tradeoffs, and rough TCO. Skip implementation details. Use business language."
    ),
    "investor": (
        "a non-technical investor",
        "Focus on: what problem this solves, why Azure, cost at scale, competitive moat from the tech choices, "
        "and what could go wrong operationally. No jargon. Use analogies."
    ),
    "developer": (
        "a software developer joining the team",
        "Explain every service in plain English, what it does, why it was chosen over simpler alternatives, "
        "and how data flows through the system step by step. Include integration patterns, SDKs, and what they'd work on day-to-day."
    ),
    "devops": (
        "a DevOps / SRE engineer",
        "Focus on: deployment topology, CI/CD integration points, observability hooks (metrics/logs/traces), "
        "failure runbooks, scaling triggers, and on-call blast radius."
    ),
    "product": (
        "a Product Manager",
        "Focus on: what each service enables from a feature perspective, which components gate which features, "
        "cost implications of feature growth, and what architectural choices limit or unlock the roadmap."
    ),
}

_EXPLAIN_SYSTEM = """You are a technical communicator who can explain Azure architectures to any audience.

Given an architecture and a target audience, write a clear, engaging explanation tailored to that audience.

Use ## headings to organize your response. Include a data flow walkthrough.
Adapt your vocabulary, depth, and focus entirely to the audience description provided."""


async def explain_architecture(
    architecture: Architecture,
    audience: str,
    session_id: str,
) -> Dict[str, Any]:
    audience_key = audience.lower().strip().replace(" ", "_").replace("-", "_")
    audience_label, audience_guidance = _AUDIENCE_CONTEXTS.get(
        audience_key,
        (f"a {audience}", f"Tailor your explanation to what matters most to {audience}.")
    )

    user_prompt = (
        f"## Target Audience\nExplain this architecture to {audience_label}.\n"
        f"Guidance: {audience_guidance}\n\n"
        + _arch_summary(architecture)
    )

    response = await call_deepseek(
        _EXPLAIN_SYSTEM, user_prompt, session_id=session_id, update_history=True
    )

    return {"reasoning": response or "Explanation failed — no response from LLM."}
