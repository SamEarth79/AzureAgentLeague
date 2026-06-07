"""LangGraph node implementations for the ArchMind agent.

Each node receives the current AgentState, mutates it (or returns a partial
update), and returns it. LangGraph handles state propagation; the `messages`
field uses an `add` reducer so appended messages accumulate across nodes.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

from langchain_core.messages import AIMessage

from ..models.domain import (
    Architecture,
    ArchitectureMetadata,
    Connection,
    Service,
    Warning,
)
from .state import AgentState
from .tools import (
    build_architecture_metadata,
    estimate_cost,
    estimate_performance,
    query_foundry_iq,
    select_service,
    validate_architecture,
)

logger = logging.getLogger(__name__)

REFINEMENT_KEYWORDS = {
    "cheaper": "cost",
    "cheap": "cost",
    "cost": "cost",
    "less expensive": "cost",
    "save money": "cost",
    "faster": "latency",
    "low latency": "latency",
    "speed": "latency",
    "snappy": "latency",
    "reliable": "ha",
    "redundan": "ha",
    "ha": "ha",
    "failover": "ha",
    "global": "ha",
    "multi-region": "ha",
    "secure": "security",
    "compliance": "security",
    "scale": "scale",
    "scalable": "scale",
    "more capacity": "scale",
}

WORKLOAD_KEYWORDS = {
    "image": "image",
    "vision": "image",
    "thumbnail": "image",
    "photo": "image",
    "api": "web_api",
    "web": "web_api",
    "rest": "web_api",
    "ai": "ai",
    "openai": "ai",
    "gpt": "ai",
    "chatbot": "ai",
    "stream": "streaming",
    "telemetry": "streaming",
    "iot": "streaming",
    "queue": "queue",
    "async": "queue",
    "kubernet": "microservices",
    "k8s": "microservices",
    "microservice": "microservices",
    "serverless": "serverless",
}

DEFAULT_REGION = "eastus"
SECONDARY_REGION = "westus2"


def _detect_intent(text: str) -> Dict[str, Any]:
    lower = text.lower()
    workload = "web_api"
    for kw, label in WORKLOAD_KEYWORDS.items():
        if kw in lower:
            workload = label
            break

    refinements: List[str] = []
    for kw, label in REFINEMENT_KEYWORDS.items():
        if kw in lower:
            if label not in refinements:
                refinements.append(label)

    region = None
    region_match = next(
        (
            r
            for r in (
                "eastus",
                "westus2",
                "westeurope",
                "japaneast",
                "australiaeast",
                "centralus",
            )
            if r in lower
        ),
        None,
    )
    if region_match:
        region = region_match

    scale = "medium"
    if any(t in lower for t in ("10k", "10000", "high scale", "millions", "burst")):
        scale = "high"
    elif any(t in lower for t in ("small", "demo", "prototype", "low traffic")):
        scale = "low"

    return {
        "workload": workload,
        "refinements": refinements,
        "region": region,
        "scale": scale,
    }


def _empty_requirements() -> Dict[str, Any]:
    return {
        "workload": "",
        "scale": "",
        "budget": None,
        "region": "",
        "refinements": [],
        "raw": "",
    }


def _architecture_blueprint(workload: str) -> List[Dict[str, Any]]:
    """Return a list of (service_type, config, name_suffix, reasoning) tuples
    used by reason_and_select_node to build services and connections."""
    if workload == "image":
        return [
            ("Azure Blob Storage", {"tier": "Hot"}, "Image Store", "Durable input storage for uploaded images."),
            ("Azure Event Grid", {}, "Event Router", "Triggers processing on new image uploads."),
            ("Azure Functions", {"plan": "consumption", "runtime": "python"}, "Image Processor", "Event-driven compute for image transformations."),
            ("Application Insights", {}, "Observability", "Trace and monitor processing pipeline."),
        ]
    if workload == "ai":
        return [
            ("Azure Blob Storage", {"tier": "Hot"}, "Doc Store", "Source documents for RAG."),
            ("Azure AI Search", {"tier": "Basic"}, "Vector Index", "Vector + semantic search over documents."),
            ("Azure Functions", {"plan": "consumption", "runtime": "python"}, "Retrieval Orchestrator", "Embeds queries, calls OpenAI, returns answers."),
            ("Azure OpenAI Service", {"model": "gpt-4o"}, "GPT-4o", "Generates grounded answers."),
            ("Azure Cosmos DB", {"multi_region": False}, "Conversation Store", "Persists chat history per user."),
        ]
    if workload == "streaming":
        return [
            ("Azure Event Hubs", {"tier": "Standard"}, "Telemetry Ingest", "High-throughput event ingestion."),
            ("Azure Functions", {"plan": "consumption", "runtime": "python"}, "Stream Processor", "Aggregates and enriches events."),
            ("Azure SQL Database", {"tier": "Standard"}, "Aggregated Store", "Stores rollups for analytics."),
            ("Application Insights", {}, "Observability", "Pipeline metrics and traces."),
        ]
    if workload == "queue":
        return [
            ("Azure App Service", {"plan": "Basic"}, "Web API", "REST API host."),
            ("Azure Service Bus", {"tier": "Standard"}, "Task Queue", "Decouples request handling from work."),
            ("Azure Functions", {"plan": "consumption"}, "Worker", "Consumes and processes queued work."),
            ("Azure SQL Database", {"tier": "Basic"}, "State Store", "Persists task results."),
        ]
    if workload == "microservices":
        return [
            ("Azure Kubernetes Service", {"node_count": 3}, "Cluster", "Orchestrates containerized microservices."),
            ("Azure Container Apps", {}, "Auxiliary Service", "Lightweight companion service."),
            ("Azure Cosmos DB", {"multi_region": True}, "Shared State", "Multi-region NoSQL store."),
            ("Azure Front Door", {}, "Global Router", "Routes traffic to nearest region."),
        ]
    if workload == "serverless":
        return [
            ("Azure Functions", {"plan": "consumption"}, "API Backend", "Serverless REST API."),
            ("Azure Cosmos DB", {"multi_region": False}, "Data Store", "Low-latency NoSQL store."),
            ("Azure Blob Storage", {"tier": "Cool"}, "File Store", "Cheap object storage."),
        ]
    if workload == "global":
        return [
            ("Azure Front Door", {}, "Global Edge", "Routes users to nearest region."),
            ("Azure App Service", {"plan": "Standard"}, "Regional Web", "Hosts the web app in each region."),
            ("Azure Cosmos DB", {"multi_region": True}, "Global Data", "Multi-region writes for global users."),
        ]
    return [
        ("Azure App Service", {"plan": "Basic"}, "Web API", "Hosts the REST API."),
        ("Azure SQL Database", {"tier": "Basic"}, "Data Store", "Relational store for app data."),
        ("Azure Blob Storage", {"tier": "Hot"}, "File Store", "Stores user uploads."),
    ]


def _build_services(
    blueprint: List[Dict[str, Any]],
    region: str,
) -> List[Service]:
    services: List[Service] = []
    for svc_type, config, name, reasoning in blueprint:
        svc = Service(
            id=f"svc-{len(services) + 1}-{svc_type.lower().replace(' ', '-').replace('azure-', '')}",
            type=svc_type,
            name=name,
            config=dict(config),
            reasoning=reasoning,
            region=region,
        )
        entry = next((e for e in _CATALOG_LOOKUP if e["type"] == svc_type), None)
        if entry is not None:
            svc.cost_estimate = float(entry["base_cost"])
        services.append(svc)
    return services


def _connect(services: List[Service]) -> List[Connection]:
    """Build a simple linear chain of connections (storage → compute, etc.)."""
    connections: List[Connection] = []
    for i in range(len(services) - 1):
        src, dst = services[i], services[i + 1]
        conn_type = "async" if any(
            t in dst.type for t in ("Functions", "Event Grid", "Event Hubs")
        ) else "sync"
        protocol = None
        if "Event Grid" in src.type or "Event Grid" in dst.type:
            conn_type = "event-driven"
            protocol = "Event Grid"
        elif "Service Bus" in src.type or "Service Bus" in dst.type:
            conn_type = "async"
            protocol = "AMQP"
        connections.append(
            Connection(
                id=f"conn-{i + 1}",
                source_id=src.id,
                target_id=dst.id,
                type=conn_type,
                protocol=protocol,
            )
        )
    return connections


_CATALOG_LOOKUP: List[Dict[str, Any]] = []


def _ensure_catalog() -> None:
    if _CATALOG_LOOKUP:
        return
    from .tools import SERVICE_CATALOG
    _CATALOG_LOOKUP.extend(SERVICE_CATALOG)


def _apply_refinement(
    services: List[Service],
    connections: List[Connection],
    refinements: List[str],
) -> List[Warning]:
    """Modify the architecture in response to refinement hints. Returns
    a list of warnings describing the changes (for streaming)."""
    notes: List[Warning] = []

    if "cost" in refinements:
        for s in services:
            if s.type == "Azure Blob Storage" and s.config.get("tier") == "Hot":
                s.config["tier"] = "Cool"
                s.cost_estimate = max(1.0, (s.cost_estimate or 5.0) * 0.4)
                notes.append(
                    Warning(
                        severity="info",
                        category="refinement",
                        message=f"Switched {s.name} to Cool tier to reduce storage cost.",
                        affected_services=[s.id],
                    )
                )
        for s in services:
            if s.type == "Azure Kubernetes Service":
                s.type = "Azure Container Apps"
                s.name = "Container Apps"
                s.cost_estimate = max(10.0, (s.cost_estimate or 73.0) * 0.4)
                notes.append(
                    Warning(
                        severity="info",
                        category="refinement",
                        message="Replaced AKS with Azure Container Apps to cut compute cost.",
                        affected_services=[s.id],
                    )
                )

    if "latency" in refinements:
        if not any(s.type == "Azure Front Door" for s in services):
            fd = Service(
                id=f"svc-{len(services) + 1}-front-door",
                type="Azure Front Door",
                name="Global Edge",
                config={},
                reasoning="Added to reduce user-facing latency via edge caching and routing.",
                cost_estimate=35.0,
                region=services[0].region if services else DEFAULT_REGION,
            )
            services.insert(0, fd)
            if services:
                connections.insert(
                    0,
                    Connection(
                        id=f"conn-{len(connections) + 1}",
                        source_id=fd.id,
                        target_id=services[1].id,
                        type="sync",
                        protocol="HTTPS",
                    ),
                )
            notes.append(
                Warning(
                    severity="info",
                    category="refinement",
                    message="Added Azure Front Door for lower latency and global edge routing.",
                    affected_services=[fd.id],
                )
            )

    if "ha" in refinements:
        for s in services:
            if s.region == DEFAULT_REGION and s.type not in {
                "Application Insights",
                "Azure Monitor",
            }:
                s.region = SECONDARY_REGION
        if services and all(s.region == SECONDARY_REGION for s in services):
            notes.append(
                Warning(
                    severity="info",
                    category="refinement",
                    message=f"Replicated services to {SECONDARY_REGION} for higher availability.",
                    affected_services=[s.id for s in services],
                )
            )

    if "scale" in refinements:
        for s in services:
            if s.type == "Azure App Service":
                s.config["plan"] = "Premium"
                s.cost_estimate = (s.cost_estimate or 13.0) + 30.0
                notes.append(
                    Warning(
                        severity="info",
                        category="refinement",
                        message="Upgraded App Service plan for higher scale.",
                        affected_services=[s.id],
                    )
                )

    if "security" in refinements:
        if not any(s.type == "Azure API Management" for s in services):
            apim = Service(
                id=f"svc-{len(services) + 1}-apim",
                type="Azure API Management",
                name="API Gateway",
                config={"tier": "Developer"},
                reasoning="Added for centralized auth, rate limiting, and policy enforcement.",
                cost_estimate=48.0,
                region=services[0].region if services else DEFAULT_REGION,
            )
            services.insert(0, apim)
            if len(services) > 1:
                connections.insert(
                    0,
                    Connection(
                        id=f"conn-{len(connections) + 1}",
                        source_id=apim.id,
                        target_id=services[1].id,
                        type="sync",
                        protocol="HTTPS",
                    ),
                )
            notes.append(
                Warning(
                    severity="info",
                    category="refinement",
                    message="Added API Management for auth, throttling, and policy enforcement.",
                    affected_services=[apim.id],
                )
            )

    return notes


async def parse_requirements_node(state: AgentState) -> Dict[str, Any]:
    _ensure_catalog()
    user_message = state.get("user_message", "")
    existing = state.get("existing_architecture")
    is_refinement = existing is not None
    is_clarification_response = bool(state.get("is_clarification_response"))
    original_prompt = state.get("original_prompt")

    if is_clarification_response and original_prompt:
        effective_message = f"{original_prompt}\nFollow-up answer: {user_message}"
    else:
        effective_message = user_message

    intent = _detect_intent(effective_message)

    if is_refinement and not intent["refinements"] and intent["workload"] == "web_api":
        if existing is not None and existing.services:
            svc_types = " ".join(s.type for s in existing.services)
            inferred = _detect_intent(svc_types).get("workload") or "web_api"
            if inferred != "web_api":
                intent["workload"] = inferred

    requirements = {
        "workload": intent["workload"],
        "scale": intent["scale"],
        "budget": None,
        "region": intent["region"] or (existing.metadata.regions[0] if existing and existing.metadata.regions else DEFAULT_REGION),
        "refinements": intent["refinements"],
        "raw": effective_message,
    }

    needs_clarification = False
    if is_clarification_response:
        needs_clarification = False
    elif not intent["region"] and not is_refinement:
        needs_clarification = True

    if is_clarification_response:
        summary = (
            f"Merged answer with original prompt. "
            f"workload='{requirements['workload']}', "
            f"scale='{requirements['scale']}', region='{requirements['region']}'."
        )
    elif is_refinement:
        summary = (
            f"Parsed intent: workload='{requirements['workload']}', "
            f"scale='{requirements['scale']}', region='{requirements['region']}'. "
            f"Refining existing architecture."
        )
    else:
        summary = (
            f"Parsed intent: workload='{requirements['workload']}', "
            f"scale='{requirements['scale']}', region='{requirements['region']}'. "
            f"Generating new architecture."
        )

    return {
        "status": "parsing",
        "user_requirements": requirements,
        "is_refinement": is_refinement,
        "is_clarification_response": False,
        "needs_clarification": needs_clarification,
        "messages": [AIMessage(content=summary)],
    }


_CLARIFICATION_QUESTIONS = {
    "region": "Which Azure region should this deploy to? (e.g., eastus, westus2, westeurope)",
    "scale": "What scale are you expecting? (low / medium / high traffic, or specific numbers)",
}


async def request_clarification_node(state: AgentState) -> Dict[str, Any]:
    requirements = state.get("user_requirements") or _empty_requirements()
    missing: List[str] = []
    questions: List[str] = []

    if not requirements.get("region"):
        missing.append("region")
        questions.append(_CLARIFICATION_QUESTIONS["region"])
    if not requirements.get("scale"):
        missing.append("scale")
        questions.append(_CLARIFICATION_QUESTIONS["scale"])

    if not questions:
        questions = ["Could you provide a bit more detail about what you want to build?"]
        missing = ["workload"]

    user_message = state.get("user_message", "")
    note = (
        "I need a bit more info before I can design the architecture. "
        f"Original request: \"{user_message[:200]}\". "
        f"Questions: {' '.join(questions)}"
    )

    return {
        "status": "asking_clarification",
        "pending_clarifications": questions,
        "pending_missing_fields": missing,
        "messages": [AIMessage(content=note)],
    }


async def query_foundry_iq_node(state: AgentState) -> Dict[str, Any]:
    reqs = state.get("user_requirements") or _empty_requirements()
    query = f"{reqs.get('workload', '')} {reqs.get('raw', '')}".strip() or "general"
    result = await query_foundry_iq(query)

    return {
        "status": "querying",
        "messages": [
            AIMessage(content=f"Foundry IQ result: {result}"),
        ],
    }


async def reason_and_select_node(state: AgentState) -> Dict[str, Any]:
    reqs = state.get("user_requirements") or _empty_requirements()
    workload = reqs.get("workload") or "web_api"
    region = reqs.get("region") or DEFAULT_REGION
    refinements = reqs.get("refinements") or []
    existing = state.get("existing_architecture")

    if existing is not None:
        services = [s.model_copy(deep=True) for s in existing.services]
        connections = [c.model_copy(deep=True) for c in existing.connections]
        for s in services:
            s.region = region
        for s in services:
            entry = next(
                (e for e in _CATALOG_LOOKUP if e["type"] == s.type),
                None,
            )
            if entry is not None:
                s.cost_estimate = float(entry["base_cost"])
        refinement_notes = _apply_refinement(services, connections, refinements)
    else:
        blueprint = _architecture_blueprint(workload)
        services = _build_services(blueprint, region)
        connections = _connect(services)
        refinement_notes = _apply_refinement(services, connections, refinements)

    summary = (
        f"Selected {len(services)} services for '{workload}' "
        f"in {region}: " + ", ".join(s.type for s in services)
    )

    return {
        "status": "reasoning",
        "selected_services": services,
        "connections": connections,
        "warnings": refinement_notes,
        "messages": [AIMessage(content=summary)],
    }


async def validate_architecture_node(state: AgentState) -> Dict[str, Any]:
    services = state.get("selected_services") or []
    connections = state.get("connections") or []
    new_warnings = await validate_architecture(services, connections)

    has_high = any(w.severity == "high" for w in new_warnings)
    has_medium = any(w.severity == "medium" for w in new_warnings)
    validation_passed = not has_high

    summary = (
        f"Validation: {len(new_warnings)} issue(s) found "
        f"({sum(1 for w in new_warnings if w.severity == 'high')} high, "
        f"{sum(1 for w in new_warnings if w.severity == 'medium')} medium). "
        + ("Self-correcting." if not validation_passed else "Validation passed.")
    )

    return {
        "status": "validating",
        "warnings": new_warnings,
        "validation_passed": validation_passed,
        "messages": [AIMessage(content=summary)],
    }


async def self_correct_node(state: AgentState) -> Dict[str, Any]:
    services = state.get("selected_services") or []
    connections = state.get("connections") or []
    existing_warnings = state.get("warnings") or []
    iteration = int(state.get("iteration", 0)) + 1

    fix_notes: List[Warning] = []
    high_warnings = [w for w in existing_warnings if w.severity == "high"]
    medium_warnings = [w for w in existing_warnings if w.severity == "medium"]

    if any(w.category == "single_point_of_failure" for w in high_warnings):
        if not any(s.type == "Azure Service Bus" for s in services):
            sb = Service(
                id=f"svc-{len(services) + 1}-service-bus",
                type="Azure Service Bus",
                name="Task Queue",
                config={"tier": "Standard"},
                reasoning="Buffer added in front of compute to eliminate SPOF.",
                cost_estimate=10.0,
                region=services[0].region if services else DEFAULT_REGION,
            )
            services.insert(0, sb)
            if len(services) > 1:
                connections.insert(
                    0,
                    Connection(
                        id=f"conn-{len(connections) + 1}",
                        source_id=sb.id,
                        target_id=services[1].id,
                        type="async",
                        protocol="AMQP",
                    ),
                )
            fix_notes.append(
                Warning(
                    severity="info",
                    category="self_correction",
                    message="Added Azure Service Bus to buffer compute load (SPOF fix).",
                    affected_services=[sb.id],
                )
            )

    if any(w.category == "tight_coupling" for w in medium_warnings):
        if not any(s.type in {"Azure Service Bus", "Azure Event Grid", "Azure Queue Storage"} for s in services):
            sb = Service(
                id=f"svc-{len(services) + 1}-service-bus",
                type="Azure Service Bus",
                name="Task Queue",
                config={"tier": "Standard"},
                reasoning="Decouples producers and consumers.",
                cost_estimate=10.0,
                region=services[0].region if services else DEFAULT_REGION,
            )
            services.insert(max(1, len(services) - 1), sb)
            fix_notes.append(
                Warning(
                    severity="info",
                    category="self_correction",
                    message="Added Service Bus to decouple tight coupling.",
                    affected_services=[sb.id],
                )
            )

    if any(w.category == "single_region" for w in medium_warnings):
        for s in services:
            if s.type not in {"Application Insights", "Azure Monitor"}:
                s.region = SECONDARY_REGION
        fix_notes.append(
            Warning(
                severity="info",
                category="self_correction",
                message=f"Replicated services to {SECONDARY_REGION} for HA.",
                affected_services=[s.id for s in services],
            )
        )

    return {
        "status": "self_correcting",
        "selected_services": services,
        "connections": connections,
        "warnings": fix_notes,
        "iteration": iteration,
        "messages": [
            AIMessage(
                content=(
                    f"Self-correction #{iteration}: applied "
                    f"{len(fix_notes)} fix(es)."
                )
            )
        ],
    }


async def estimate_cost_performance_node(state: AgentState) -> Dict[str, Any]:
    services = state.get("selected_services") or []
    connections = state.get("connections") or []
    cost = await estimate_cost(services)
    perf = await estimate_performance(services, connections)
    metadata = build_architecture_metadata(services, connections, cost, perf)

    summary = (
        f"Estimated cost: ${cost['monthly_total']}/mo, "
        f"latency p95: {perf['latency_p95']}, throughput: {perf['throughput']}."
    )

    return {
        "status": "estimating",
        "metadata": metadata,
        "messages": [AIMessage(content=summary)],
    }


async def generate_output_node(state: AgentState) -> Dict[str, Any]:
    return {
        "status": "complete",
        "messages": [
            AIMessage(content="Architecture ready. Sending final output to canvas."),
        ],
    }
