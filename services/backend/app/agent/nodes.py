"""LangGraph node implementations for the ArchMind agent.

Each node receives the current AgentState, mutates it (or returns a partial
update), and returns it. LangGraph handles state propagation; the `messages`
field uses an `add` reducer so appended messages accumulate across nodes.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional

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
    append_to_session,
    SERVICE_CATALOG,
    build_architecture_metadata,
    call_deepseek,
    estimate_cost,
    estimate_performance,
    query_foundry_iq,
    validate_architecture,
)

logger = logging.getLogger(__name__)

REFINEMENT_KEYWORDS = {
    "cheaper": "cost",
    "cheap": "cost",
    "cost": "cost",
    "less expensive": "cost",
    "save money": "cost",
    "reduce cost": "cost",
    "reduce": "cost",
    "budget": "cost",
    "expensive": "cost",
    "faster": "latency",
    "low latency": "latency",
    "speed": "latency",
    "snappy": "latency",
    "cach": "latency",
    "performance": "latency",
    "reliable": "ha",
    "redundan": "ha",
    "ha": "ha",
    "failover": "ha",
    "global": "ha",
    "multi-region": "ha",
    "high avail": "ha",
    "add redundan": "ha",
    "disaster": "ha",
    "secure": "security",
    "compliance": "security",
    "auth": "security",
    "zero trust": "security",
    "scale": "scale",
    "scalable": "scale",
    "more capacity": "scale",
    "traffic spike": "scale",
    "autoscal": "scale",
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
    "etl": "etl",
    "pipeline": "etl",
}

DEFAULT_REGION = "eastus"
SECONDARY_REGION = "westus2"


def _detect_intent(text: str) -> Dict[str, Any]:
    lower = text.lower()
    workload = "web_api"
    workload_matched = False
    for kw, label in WORKLOAD_KEYWORDS.items():
        if kw in lower:
            workload = label
            workload_matched = True
            break

    refinements: List[str] = []
    for kw, label in REFINEMENT_KEYWORDS.items():
        if kw in lower:
            if label not in refinements:
                refinements.append(label)

    region = None
    # Normalize spaces/dashes so "East US" matches "eastus"
    normalized = lower.replace(" ", "").replace("-", "").replace("_", "")
    region_match = next(
        (
            r
            for r in (
                "eastus",
                "westus2",
                "westus",
                "westeurope",
                "japaneast",
                "australiaeast",
                "centralus",
                "southeastasia",
                "uksouth",
                "northeurope",
                "eastus2",
            )
            if r in normalized
        ),
        None,
    )
    if region_match:
        region = region_match

    scale = None
    req_per_min: Optional[float] = None

    # Try to extract an explicit number first (e.g. "10k req/min", "50000 requests")
    num_match = re.search(r"(\d+(?:\.\d+)?)\s*k?\s*(?:req|request|rps|rpm|/min|per min)", lower)
    if num_match:
        val = float(num_match.group(1))
        if "k" in lower[num_match.start():num_match.end()]:
            val *= 1000
        req_per_min = val

    if any(t in lower for t in ("10k", "10000", "high scale", "millions", "burst")):
        scale = "high"
        if req_per_min is None:
            req_per_min = 10_000.0
    elif any(t in lower for t in ("small", "demo", "prototype", "low traffic")):
        scale = "low"
        if req_per_min is None:
            req_per_min = 500.0

    # Map clarification option strings to req_per_min
    if req_per_min is None:
        if "very high" in lower or "100k+" in lower or "100k +" in lower:
            scale = "very_high"
            req_per_min = 200_000.0
        elif "high" in lower and ("10k" in lower or "100k" in lower):
            scale = "high"
            req_per_min = 50_000.0
        elif "medium" in lower or ("1k" in lower and "10k" in lower):
            scale = "medium"
            req_per_min = 5_000.0
        elif "low" in lower or "1k" in lower:
            scale = "low"
            req_per_min = 500.0

    return {
        "workload": workload,
        "workload_matched": workload_matched,
        "refinements": refinements,
        "region": region,
        "scale": scale,
        "req_per_min": req_per_min,
    }


def _empty_requirements() -> Dict[str, Any]:
    return {
        "workload": "",
        "scale": "",
        "req_per_min": None,
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
    if workload == "etl":
        return [
            ("Azure Functions", {"plan": "consumption", "runtime": "python"}, "ETL Orchestrator", "Orchestrates the ETL pipeline tasks."),
            ("Azure Blob Storage", {"tier": "Hot"}, "Raw Data Lake", "Stores raw ingested data."),
            ("Azure SQL Database", {"tier": "Standard"}, "Transformed Store", "Stores transformed data for querying."),
            ("Azure Monitor", {}, "Pipeline Monitoring", "Tracks pipeline health and metrics."),
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


_TIER_ORDER = [
    # tier 0 — entry / networking
    {"Azure Front Door", "Azure CDN", "Azure API Management"},
    # tier 1 — compute
    {"Azure Functions", "Azure App Service", "Azure Container Apps", "Azure Kubernetes Service"},
    # tier 2 — messaging / eventing
    {"Azure Service Bus", "Azure Event Grid", "Azure Event Hubs", "Azure Queue Storage"},
    # tier 3 — storage / database
    {"Azure Blob Storage", "Azure Cosmos DB", "Azure SQL Database", "Azure Table Storage"},
    # tier 4 — AI
    {"Azure OpenAI Service", "Azure AI Search", "Azure Document Intelligence"},
    # tier 5 — observability (leaf, no outgoing edges)
    {"Azure Monitor", "Application Insights"},
]


def _tier(svc: Service) -> int:
    for i, group in enumerate(_TIER_ORDER):
        if svc.type in group:
            return i
    return 3  # unknown → treat as storage tier


def _conn_meta(src: Service, dst: Service):
    if "Event Grid" in src.type or "Event Grid" in dst.type:
        return "event-driven", "Event Grid"
    if "Service Bus" in src.type or "Service Bus" in dst.type:
        return "async", "AMQP"
    if "Event Hubs" in src.type or "Event Hubs" in dst.type:
        return "async", "AMQP"
    if any(t in dst.type for t in ("Functions", "Event Grid", "Event Hubs")):
        return "async", None
    return "sync", None


def _connect(services: List[Service]) -> List[Connection]:
    """Build topology-aware connections. Main services chain by tier; observability taps from compute."""
    if not services:
        return []

    obs = [s for s in services if _tier(s) == 5]
    main = sorted([s for s in services if _tier(s) != 5], key=_tier)

    connections: List[Connection] = []
    conn_idx = 1
    seen: set = set()

    def add(src: Service, dst: Service) -> None:
        nonlocal conn_idx
        pair = (src.id, dst.id)
        if pair in seen:
            return
        seen.add(pair)
        conn_type, protocol = _conn_meta(src, dst)
        connections.append(Connection(
            id=f"conn-{conn_idx}",
            source_id=src.id,
            target_id=dst.id,
            type=conn_type,
            protocol=protocol,
        ))
        conn_idx += 1

    # Linear chain through main services ordered by tier
    for i in range(len(main) - 1):
        add(main[i], main[i + 1])

    # Observability taps from first compute service (tier 1), else first main service
    anchor = next((s for s in main if _tier(s) == 1), main[0] if main else None)
    if anchor:
        for o in obs:
            add(anchor, o)

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
                s.cost_estimate = max(1.0, (s.cost_estimate or 15.0) * 0.4)
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
        for s in services:
            if s.type == "Azure App Service" and s.config.get("plan") in ("Standard", "Basic", None):
                s.type = "Azure Functions"
                s.name = s.name or "Serverless Backend"
                s.config["plan"] = "consumption"
                s.cost_estimate = max(2.0, (s.cost_estimate or 13.0) * 0.15)
                notes.append(
                    Warning(
                        severity="info",
                        category="refinement",
                        message="Replaced App Service with Azure Functions (consumption plan) for pay-per-use cost.",
                        affected_services=[s.id],
                    )
                )
        for s in services:
            if s.type == "Azure SQL Database" and s.config.get("tier") in ("Standard", None):
                s.config["tier"] = "Basic"
                s.cost_estimate = max(5.0, (s.cost_estimate or 30.0) * 0.3)
                notes.append(
                    Warning(
                        severity="info",
                        category="refinement",
                        message=f"Downgraded {s.name} to Basic tier to reduce database cost.",
                        affected_services=[s.id],
                    )
                )
        for s in services:
            if s.type == "Azure Cosmos DB" and not s.config.get("serverless"):
                s.config["serverless"] = True
                s.cost_estimate = max(5.0, (s.cost_estimate or 25.0) * 0.4)
                notes.append(
                    Warning(
                        severity="info",
                        category="refinement",
                        message=f"Switched {s.name} to serverless mode to reduce idle cost.",
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


_CLASSIFY_SYSTEM = """You are a routing classifier for an AI cloud architect tool.

Classify the user message as exactly one of:
- "chat"        — the user is asking a question, wanting an explanation, or requesting information (e.g. "what is Cosmos DB?", "why did you choose Functions?", "explain the tradeoffs")
- "architecture" — the user wants to design, generate, modify, refine, or update an architecture (e.g. "build me a pipeline", "make it cheaper", "add a load balancer", "switch to serverless")

If a current architecture exists, lean toward "architecture" for any message that could be a modification request, even if phrased as a question (e.g. "can you make this more reliable?" → architecture).

Reply with ONLY the single word: chat  OR  architecture"""


async def _classify_intent(user_message: str, has_existing_architecture: bool, session_id: Optional[str] = None) -> bool:
    """Returns True if the message is a chat/Q&A question, False if it's an architecture request."""
    context = "A current architecture exists." if has_existing_architecture else "No architecture exists yet."
    raw = await call_deepseek(
        _CLASSIFY_SYSTEM,
        f"{context}\n\nUser message: {user_message}",
        session_id=session_id,
        update_history=False,
    )
    result = (raw or "").strip().lower()
    logger.info("[classify_intent] message=%r result=%r", user_message[:60], result)
    # Default to architecture on any ambiguity or LLM failure
    return result == "chat"


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

    # Inherit req_per_min from existing architecture's requirements if refining
    existing_req_per_min = None
    if is_refinement and state.get("user_requirements"):
        existing_req_per_min = state["user_requirements"].get("req_per_min")

    requirements = {
        "workload": intent["workload"],
        "scale": intent["scale"],
        "req_per_min": intent["req_per_min"] or existing_req_per_min,
        "budget": None,
        "region": intent["region"],
        "refinements": intent["refinements"],
        "raw": effective_message,
    }

    # Gate logic — only on fresh requests, never on any kind of follow-up response
    needs_clarification = False
    missing_fields: List[str] = []

    existing_region = (
        existing.metadata.regions[0]
        if existing and existing.metadata and existing.metadata.regions
        else None
    )

    is_validation_response = bool(state.get("is_validation_response"))
    should_gate = not is_clarification_response and not is_refinement and not is_validation_response

    if should_gate:
        if not intent["workload_matched"] and intent["workload"] == "web_api":
            missing_fields.append("workload")
            needs_clarification = True

        if intent["scale"] is None:
            missing_fields.append("scale")
            needs_clarification = True

        if intent["region"] is None and existing_region is None:
            missing_fields.append("region")
            needs_clarification = True

    if existing_region and not requirements["region"]:
        requirements["region"] = existing_region
    if not requirements["region"]:
        requirements["region"] = DEFAULT_REGION

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

    is_chat = False
    if not is_clarification_response and not is_validation_response:
        is_chat = await _classify_intent(user_message, existing is not None, session_id=state.get("session_id"))

    return {
        "status": "parsing",
        "user_requirements": requirements,
        "is_refinement": is_refinement,
        "is_chat_question": is_chat,
        "is_clarification_response": False,
        "needs_clarification": needs_clarification,
        "pending_missing_fields": missing_fields,
        "messages": [AIMessage(content=summary)],
    }


_CLARIFICATION_QUESTIONS = {
    "workload": {
        "id": "workload",
        "question": "What type of system are you building?",
        "options": [
            "Web API / REST Service",
            "Real-time streaming pipeline",
            "AI / ML workload",
            "Image or video processing",
            "Microservices platform",
            "Serverless / event-driven",
            "Data pipeline / ETL",
        ],
    },
    "scale": {
        "id": "scale",
        "question": "What scale are you targeting?",
        "options": [
            "Low  —  under 1K req/min",
            "Medium  —  1K–10K req/min",
            "High  —  10K–100K req/min",
            "Very High  —  100K+ req/min",
        ],
    },
    "region": {
        "id": "region",
        "question": "Which Azure region should this deploy to?",
        "options": [
            "East US",
            "West US 2",
            "West Europe",
            "Southeast Asia",
            "Australia East",
            "UK South",
        ],
    },
}


async def chat_qa_node(state: AgentState) -> Dict[str, Any]:
    question = state.get("user_message", "")
    arch = state.get("existing_architecture")

    arch_context = ""
    if arch and arch.services:
        arch_context = "Current architecture: " + ", ".join(
            f"{s.name} ({s.type})" for s in arch.services
        )

    iq_result = await query_foundry_iq(question)

    system = (
        "You are ArchMind, an Azure cloud architect assistant. "
        "Answer the user's question about Azure services, architecture patterns, or cloud design. "
        "Be concise and practical. 2-4 sentences max unless more detail is clearly needed."
    )
    user_prompt = (
        f"Question: {question}\n\n"
        + (f"{arch_context}\n\n" if arch_context else "")
        + f"Relevant Azure docs:\n{iq_result}"
    )

    answer = await call_deepseek(system, user_prompt, session_id=state.get("session_id"), update_history=True)
    if not answer:
        answer = (
            "I can help with Azure architecture questions — try asking about specific services, "
            "tradeoffs, or design patterns."
        )

    logger.info("[chat_answer] question=%r answer_len=%d", question[:60], len(answer))

    return {
        "status": "chat",
        "chat_answer_text": answer,
        "messages": [AIMessage(content=answer)],
    }


async def request_clarification_node(state: AgentState) -> Dict[str, Any]:
    missing_fields: List[str] = state.get("pending_missing_fields") or []
    questions: List[Dict[str, Any]] = [
        _CLARIFICATION_QUESTIONS[f] for f in missing_fields if f in _CLARIFICATION_QUESTIONS
    ]

    user_message = state.get("user_message", "")
    note = (
        "I need a few more details before I can design this architecture."
    )

    return {
        "status": "asking_clarification",
        "pending_clarifications": questions,
        "pending_missing_fields": missing_fields,
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


_CATALOG_TYPES = [s["type"] for s in SERVICE_CATALOG]

_DEEPSEEK_SYSTEM = """You are an Azure cloud architect. Given a user's workload description and relevant Azure documentation retrieved from Foundry IQ, select the best set of Azure services for their architecture.

Return ONLY a JSON array. No markdown, no explanation, no code fences. Each element:
{
  "type": "<exact Azure service type from the allowed list>",
  "name": "<short friendly name>",
  "config": {"key": "value"},
  "reasoning": "<one sentence why this service fits>"
}

Allowed service types (use exactly as written):
""" + "\n".join(f"- {t}" for t in _CATALOG_TYPES) + """

Rules:
- Return 3-6 services. Always include at least one compute and one storage service.
- Choose based on the workload and the Foundry IQ context provided.
- Prefer managed/serverless for cost-efficiency unless scale/control is needed.
- Do not invent service types not in the allowed list."""


async def _llm_blueprint(user_description: str, iq_context: str, region: str, session_id: Optional[str] = None) -> List[Dict]:
    """Call DeepSeek to select services. Returns blueprint tuples or empty list on failure."""
    import json as _json
    logger.info("[LLM] _llm_blueprint called: desc=%r iq_len=%d", user_description[:80], len(iq_context))

    user_prompt = (
        f"User requirement: {user_description}\n\n"
        f"Foundry IQ context:\n{iq_context}\n\n"
        f"Target region: {region}\n\n"
        "Return the JSON array of services now."
    )
    raw = ""
    try:
        raw = await call_deepseek(_DEEPSEEK_SYSTEM, user_prompt, session_id=session_id, update_history=True)
    except Exception as exc:
        logger.warning("Failed to call DeepSeek: %s", exc)
        return []
    if not raw:
        return []
    # Strip accidental markdown fences
    raw = raw.strip()
    if raw.startswith("```"):
        raw = "\n".join(raw.split("\n")[1:])
        raw = raw.rsplit("```", 1)[0].strip()
    try:
        items = _json.loads(raw)
        if not isinstance(items, list):
            return []
        # Validate each item has required fields and known type
        valid = []
        for item in items:
            if not isinstance(item, dict):
                continue
            svc_type = item.get("type", "")
            if svc_type not in _CATALOG_TYPES:
                logger.warning("DeepSeek returned unknown service type %r — skipping", svc_type)
                continue
            valid.append((
                svc_type,
                item.get("config") or {},
                item.get("name") or svc_type.replace("Azure ", ""),
                item.get("reasoning") or f"Selected {svc_type} based on requirements.",
            ))
        return valid
    except Exception as exc:
        logger.warning("Failed to parse DeepSeek blueprint JSON: %s\nRaw: %s", exc, raw[:500])
        return []


async def reason_and_select_node(state: AgentState) -> Dict[str, Any]:
    reqs = state.get("user_requirements") or _empty_requirements()
    workload = reqs.get("workload") or "web_api"
    region = reqs.get("region") or DEFAULT_REGION
    refinements = reqs.get("refinements") or []
    existing = state.get("existing_architecture")
    session_id = state.get("session_id")

    if existing is not None:
        # Extract IQ context from state messages
        iq_context = ""
        for msg in reversed(state.get("messages") or []):
            content = getattr(msg, "content", "") or ""
            if "FoundryIQ" in content or "Foundry IQ" in content:
                iq_context = content
                break

        user_desc = reqs.get("raw") or ""
        existing_summary = ", ".join(
            f"{s.name} ({s.type})" for s in existing.services
        )
        llm_system = (
            _DEEPSEEK_SYSTEM
            + f"\n\nThe user is MODIFYING an existing architecture. Current services: {existing_summary}. "
            "Apply the user's requested change. Keep services that should stay, remove if asked. "
            "If the user's request implies new capability the current architecture does not already provide "
            "(e.g. mitigating a single point of failure, adding redundancy, caching, monitoring, a queue, "
            "a CDN, autoscaling, a new tier, etc.), you MUST add one or more NEW services from the allowed "
            "list to the returned array — do not just tweak config or reasoning on existing services. "
            "A response that returns the exact same set of service types as the current services when the "
            "user asked for a change of this kind is INCORRECT. "
            "Return the COMPLETE updated service list as JSON."
        )
        llm_prompt = (
            f"User request: {user_desc}\n\n"
            f"Foundry IQ context:\n{iq_context}\n\n"
            f"Target region: {region}\n\n"
            "Return the updated JSON array of ALL services now. If this request calls for new "
            "capability, include the new service(s) in the array in addition to the existing ones "
            "that should remain."
        )
        raw = await call_deepseek(llm_system, llm_prompt, session_id=session_id, update_history=True)
        blueprint = []
        if raw:
            raw = raw.strip()
            if raw.startswith("```"):
                raw = "\n".join(raw.split("\n")[1:])
                raw = raw.rsplit("```", 1)[0].strip()
            try:
                import json as _json
                items = _json.loads(raw)
                if isinstance(items, list):
                    for item in items:
                        svc_type = item.get("type", "")
                        if svc_type in _CATALOG_TYPES:
                            blueprint.append((
                                svc_type,
                                item.get("config") or {},
                                item.get("name") or svc_type.replace("Azure ", ""),
                                item.get("reasoning") or f"Selected {svc_type}.",
                            ))
                        else:
                            logger.warning("LLM refinement: unknown type %r — skipping", svc_type)
            except Exception as exc:
                logger.warning("Failed to parse LLM refinement JSON: %s", exc)

        if blueprint:
            services = _build_services(blueprint, region)
            connections = _connect(services)
        else:
            # Fallback: keep existing unchanged
            logger.info("LLM refinement returned nothing — keeping existing architecture")
            services = [s.model_copy(deep=True) for s in existing.services]
            connections = [c.model_copy(deep=True) for c in existing.connections]
        refinement_notes = []
    else:
        # Extract Foundry IQ results from state messages
        iq_context = ""
        for msg in reversed(state.get("messages") or []):
            content = getattr(msg, "content", "") or ""
            if "FoundryIQ" in content or "Foundry IQ" in content:
                iq_context = content
                break

        user_desc = reqs.get("raw") or workload
        blueprint = await _llm_blueprint(user_desc, iq_context, region, session_id=session_id)

        if not blueprint:
            logger.info("DeepSeek blueprint empty or failed — falling back to hardcoded blueprint")
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
    is_validation_response = bool(state.get("is_validation_response"))
    fix_choices = state.get("validation_fix_choices") or {}

    def should_apply(category: str) -> bool:
        if is_validation_response:
            return fix_choices.get(category, True)
        return True

    fix_notes: List[Warning] = []
    high_warnings = [w for w in existing_warnings if w.severity == "high"]
    medium_warnings = [w for w in existing_warnings if w.severity == "medium"]

    if should_apply("single_point_of_failure") and any(w.category == "single_point_of_failure" for w in high_warnings):
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

    if should_apply("tight_coupling") and any(w.category == "tight_coupling" for w in medium_warnings):
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

    if should_apply("single_region") and any(w.category == "single_region" for w in medium_warnings):
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


async def ask_validation_fixes_node(state: AgentState) -> Dict[str, Any]:
    existing_warnings = state.get("warnings") or []
    high_warnings = [w for w in existing_warnings if w.severity == "high"]

    fix_proposals: List[Dict[str, Any]] = []
    seen: set = set()
    for w in high_warnings:
        if w.category in seen:
            continue
        seen.add(w.category)
        fix_proposals.append({
            "fix_id": w.category,
            "warning_message": w.message,
            "suggested_fix": w.suggested_fix or f"Fix the {w.category} issue.",
            "category": w.category,
            "affected_services": list(w.affected_services or []),
        })

    summary = (
        f"Validation found {len(high_warnings)} high-severity issue(s). "
        f"Presenting {len(fix_proposals)} fix proposal(s) for user approval."
    )

    return {
        "status": "asking_fixes",
        "pending_validation_fixes": fix_proposals,
        "messages": [AIMessage(content=summary)],
    }


async def estimate_cost_performance_node(state: AgentState) -> Dict[str, Any]:
    services = state.get("selected_services") or []
    connections = state.get("connections") or []
    reqs = state.get("user_requirements") or {}
    req_per_min = float(reqs.get("req_per_min") or 500.0)
    cost = await estimate_cost(services, req_per_min)
    perf = await estimate_performance(services, connections, req_per_min)
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
    services = state.get("selected_services") or []
    metadata = state.get("metadata")
    warnings = state.get("warnings") or []

    service_lines = "\n".join(
        f"- {s.name} ({s.type}): {s.reasoning}" for s in services
    )
    cost = metadata.estimated_cost_monthly if metadata else None
    perf_lines = ""
    if metadata and (metadata.estimated_latency_p95 or metadata.estimated_throughput):
        perf_lines = f"Estimated latency p95: {metadata.estimated_latency_p95 or 'N/A'}, throughput: {metadata.estimated_throughput or 'N/A'}."

    high_warnings = [w for w in warnings if w.severity == "high"]
    warning_lines = ""
    if high_warnings:
        warning_lines = "Key risks: " + "; ".join(w.message for w in high_warnings[:3]) + "."

    system = (
        "You are ArchMind, an Azure cloud architect. "
        "Write a structured summary of the architecture you just designed using markdown.\n\n"
        "Format:\n"
        "# <one-line title describing what this architecture does>\n\n"
        "A 2-3 sentence paragraph explaining the overall design and how the services fit together.\n\n"
        "## Key Decisions\n"
        "2-3 bullet points (- ...) explaining the most important service choices and why — mention service names and tradeoffs.\n\n"
        "## Risks & Tradeoffs\n"
        "1-2 bullet points covering the main risks or cost/performance tradeoffs to be aware of.\n\n"
        "Use **bold** for service names. Be specific and concise. No more than 150 words total."
    )
    user_prompt = (
        f"Services selected:\n{service_lines}\n\n"
        + (f"Monthly cost estimate: ${cost}\n" if cost else "")
        + (f"{perf_lines}\n" if perf_lines else "")
        + (f"{warning_lines}\n" if warning_lines else "")
        + "\nWrite the summary now."
    )

    summary_text = await call_deepseek(system, user_prompt, session_id=state.get("session_id"), update_history=True)
    if not summary_text:
        summary_text = (
            "Architecture designed with "
            + ", ".join(s.name for s in services[:4])
            + ("..." if len(services) > 4 else "")
            + "."
        )

    return {
        "status": "complete",
        "architecture_summary": summary_text,
        "messages": [AIMessage(content=summary_text)],
    }
