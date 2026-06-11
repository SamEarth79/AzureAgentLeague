"""Tool implementations for the ArchMind agent.

Foundry IQ retrieval (Azure AI Search, with a deterministic fallback when no
search index is configured), cost/performance estimation, and architecture
validation. LLM calls go through `call_deepseek`, an OpenAI-compatible chat
completions client currently pointed at DeepSeek for cost efficiency during
development — see the README for the rationale and the one-line swap to
Azure OpenAI / Microsoft Foundry (GPT-4o).
"""
from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Per-session conversation history
# ---------------------------------------------------------------------------
# Keyed by session_id. Each entry is a list of {role, content} dicts that
# gets prepended to every meaningful DeepSeek call so the model has full
# context of what was discussed and decided in this session.
_SESSION_HISTORY: Dict[str, List[Dict[str, str]]] = {}
_MAX_HISTORY_TURNS = 12  # keep last N user/assistant pairs (24 messages)


def get_session_history(session_id: str) -> List[Dict[str, str]]:
    return list(_SESSION_HISTORY.get(session_id, []))


def append_to_session(session_id: str, role: str, content: str) -> None:
    if session_id not in _SESSION_HISTORY:
        _SESSION_HISTORY[session_id] = []
    _SESSION_HISTORY[session_id].append({"role": role, "content": content})
    # Trim oldest pairs when over the limit
    history = _SESSION_HISTORY[session_id]
    max_msgs = _MAX_HISTORY_TURNS * 2
    if len(history) > max_msgs:
        _SESSION_HISTORY[session_id] = history[-max_msgs:]


def clear_session_history(session_id: str) -> None:
    _SESSION_HISTORY.pop(session_id, None)

from ..models.domain import (
    ArchitectureMetadata,
    Connection,
    Service,
    Warning,
)


SERVICE_CATALOG: List[Dict[str, Any]] = [
    {
        "type": "Azure Functions",
        "category": "compute",
        "use_case": "Event-driven processing, microservices",
        "base_cost": 5.0,
        "unit": "month",
        "scaling": "auto",
        "limitations": "10-min timeout, cold start",
    },
    {
        "type": "Azure App Service",
        "category": "compute",
        "use_case": "Web APIs, web apps",
        "base_cost": 13.0,
        "unit": "month",
        "scaling": "manual/auto",
        "limitations": "Vertical scaling only",
    },
    {
        "type": "Azure Container Apps",
        "category": "compute",
        "use_case": "Microservices, background jobs",
        "base_cost": 10.0,
        "unit": "month",
        "scaling": "k8s auto-scale",
        "limitations": "Requires containerization",
    },
    {
        "type": "Azure Kubernetes Service",
        "category": "compute",
        "use_case": "Complex microservices, full control",
        "base_cost": 73.0,
        "unit": "month",
        "scaling": "horizontal pod autoscaling",
        "limitations": "Higher operational overhead",
    },
    {
        "type": "Azure Blob Storage",
        "category": "storage",
        "use_case": "Unstructured data, files, backups",
        "base_cost": 5.0,
        "unit": "month",
        "scaling": "unlimited",
        "limitations": "Tier costs vary (Hot/Cool/Archive)",
    },
    {
        "type": "Azure Cosmos DB",
        "category": "storage",
        "use_case": "Global distribution, low latency",
        "base_cost": 24.0,
        "unit": "month",
        "scaling": "provisioned/autoscale",
        "limitations": "RU-based pricing",
    },
    {
        "type": "Azure SQL Database",
        "category": "storage",
        "use_case": "Transactional workloads, complex queries",
        "base_cost": 15.0,
        "unit": "month",
        "scaling": "DTU/vCore",
        "limitations": "Cost grows with scale tier",
    },
    {
        "type": "Azure Queue Storage",
        "category": "storage",
        "use_case": "Async task queues, decoupling",
        "base_cost": 1.0,
        "unit": "month",
        "scaling": "unlimited",
        "limitations": "Max 64KB message size",
    },
    {
        "type": "Azure Table Storage",
        "category": "storage",
        "use_case": "Structured NoSQL data",
        "base_cost": 2.0,
        "unit": "month",
        "scaling": "unlimited",
        "limitations": "Limited query capabilities",
    },
    {
        "type": "Azure OpenAI Service",
        "category": "ai_ml",
        "use_case": "AI features, chatbots, content generation",
        "base_cost": 30.0,
        "unit": "month",
        "scaling": "token-based",
        "limitations": "Token-based pricing",
    },
    {
        "type": "Azure AI Search",
        "category": "ai_ml",
        "use_case": "Full-text search, vector search, RAG",
        "base_cost": 75.0,
        "unit": "month",
        "scaling": "tier-based",
        "limitations": "Index storage costs",
    },
    {
        "type": "Azure Document Intelligence",
        "category": "ai_ml",
        "use_case": "OCR and document processing",
        "base_cost": 8.0,
        "unit": "month",
        "scaling": "per-page",
        "limitations": "Per-page pricing",
    },
    {
        "type": "Azure Service Bus",
        "category": "messaging",
        "use_case": "Reliable messaging, transactions",
        "base_cost": 10.0,
        "unit": "month",
        "scaling": "throughput units",
        "limitations": "Messaging unit costs",
    },
    {
        "type": "Azure Event Grid",
        "category": "messaging",
        "use_case": "Event-driven architectures",
        "base_cost": 2.0,
        "unit": "month",
        "scaling": "operations-based",
        "limitations": "Per-million-operations pricing",
    },
    {
        "type": "Azure Event Hubs",
        "category": "messaging",
        "use_case": "Telemetry, log ingestion",
        "base_cost": 11.0,
        "unit": "month",
        "scaling": "throughput units",
        "limitations": "Retention costs",
    },
    {
        "type": "Azure Front Door",
        "category": "networking",
        "use_case": "Global load balancer + CDN",
        "base_cost": 35.0,
        "unit": "month",
        "scaling": "routing rules",
        "limitations": "Traffic-based pricing",
    },
    {
        "type": "Azure API Management",
        "category": "networking",
        "use_case": "API gateway, versioning, rate limiting",
        "base_cost": 48.0,
        "unit": "month",
        "scaling": "tier-based",
        "limitations": "Developer tier limits",
    },
    {
        "type": "Azure CDN",
        "category": "networking",
        "use_case": "Static content distribution",
        "base_cost": 4.0,
        "unit": "month",
        "scaling": "GB egress",
        "limitations": "Egress-based pricing",
    },
    {
        "type": "Azure Monitor",
        "category": "monitoring",
        "use_case": "Metrics, logs, alerts",
        "base_cost": 5.0,
        "unit": "month",
        "scaling": "GB ingested",
        "limitations": "Ingestion-based pricing",
    },
    {
        "type": "Application Insights",
        "category": "monitoring",
        "use_case": "App performance monitoring",
        "base_cost": 0.0,
        "unit": "month",
        "scaling": "included in Monitor",
        "limitations": "Bundled with Azure Monitor",
    },
]


def _hash_to_float(s: str, lo: float, hi: float) -> float:
    h = int(hashlib.md5(s.encode()).hexdigest()[:8], 16)
    span = hi - lo
    return round(lo + (h % 10000) / 10000.0 * span, 2)


def _mock_foundry_iq(query: str) -> str:
    """Deterministic fallback when Azure AI Search is not configured."""
    q = query.lower()
    if "image" in q or "vision" in q or "thumbnail" in q:
        return (
            "FoundryIQ: For image processing pipelines, use Azure Functions for "
            "event-driven compute, Azure Blob Storage for input/output, and Event "
            "Grid to trigger the function on new uploads. Add Application Insights "
            "for observability. Reference: archmind://patterns/image-pipeline"
        )
    if "api" in q or "web" in q or "rest" in q:
        return (
            "FoundryIQ: For web APIs, App Service hosts the API, Azure SQL Database "
            "stores relational data, and Blob Storage handles uploads. Add API "
            "Management for versioning and rate limiting. "
            "Reference: archmind://patterns/web-api"
        )
    if "ai" in q or "gpt" in q or "openai" in q or "chatbot" in q:
        return (
            "FoundryIQ: For AI workloads, Azure OpenAI Service provides GPT models. "
            "Azure AI Search enables RAG over your data. Cosmos DB stores "
            "conversation history. Reference: archmind://patterns/ai-rag"
        )
    if "stream" in q or "telemetry" in q or "iot" in q:
        return (
            "FoundryIQ: For streaming telemetry, Event Hubs ingests events, Azure "
            "Functions processes them, and Cosmos DB or SQL stores aggregated data. "
            "Reference: archmind://patterns/streaming"
        )
    if "global" in q or "multi-region" in q or "worldwide" in q:
        return (
            "FoundryIQ: For multi-region applications, Azure Front Door routes "
            "traffic globally, App Service or Container Apps run in each region, "
            "and Cosmos DB provides multi-region writes. "
            "Reference: archmind://patterns/global-app"
        )
    return (
        "FoundryIQ: General guidance — start with managed services (App Service, "
        "SQL, Blob) for low operational overhead, add queues (Service Bus or "
        "Storage Queue) to decouple components, and enable Application Insights "
        "for observability. Reference: archmind://patterns/general-web"
    )


def _get_search_client():
    """Return an Azure AI Search client if credentials are configured, else None."""
    import os
    endpoint = os.environ.get("AZURE_SEARCH_ENDPOINT", "").strip()
    api_key = os.environ.get("AZURE_SEARCH_API_KEY", "").strip()
    index_name = os.environ.get("AZURE_SEARCH_INDEX_NAME", "archmind-iq").strip()
    if not endpoint or not api_key:
        return None, None
    try:
        from azure.search.documents import SearchClient
        from azure.core.credentials import AzureKeyCredential
        client = SearchClient(
            endpoint=endpoint,
            index_name=index_name,
            credential=AzureKeyCredential(api_key),
        )
        return client, index_name
    except Exception:
        return None, None


async def query_foundry_iq(query: str) -> str:
    """Query Azure AI Search (Foundry IQ). Falls back to mock if not configured."""
    client, _ = _get_search_client()
    if client is not None:
        try:
            results = list(client.search(
                search_text=query,
                top=3,
                select=["title", "content", "service", "category"],
            ))
            if results:
                parts = []
                for r in results:
                    parts.append(f"[{r['service']} / {r['category']}] {r['title']}: {r['content']}")
                return "FoundryIQ retrieved:\n" + "\n\n".join(parts)
        except Exception:
            pass  # fall through to mock on any search error

    return _mock_foundry_iq(query)



async def query_pricing_iq(service_name: str) -> Optional[str]:
    """Query Foundry IQ specifically for pricing data for a given service.

    Returns the raw pricing content string if found, None otherwise.
    Falls back to None (not mock) so the estimator can decide what to do.
    """
    import os
    client, _ = _get_search_client()
    if client is None:
        return None
    try:
        results = list(client.search(
            search_text=f"{service_name} pricing cost per month",
            top=2,
            select=["title", "content", "service", "category"],
            filter="category eq 'pricing'",
        ))
        for r in results:
            # Only accept documents that are clearly about this service
            if service_name.lower().replace("azure ", "") in r.get("service", "").lower() or \
               service_name.lower().replace("azure ", "") in r.get("title", "").lower():
                return r["content"]
    except Exception:
        pass
    return None


async def call_deepseek(
    system_prompt: str,
    user_prompt: str,
    session_id: Optional[str] = None,
    update_history: bool = False,
) -> str:
    """Call DeepSeek V3 via OpenAI-compatible API.

    When session_id is provided the full session conversation history is
    injected between the system message and the current user turn, giving
    the model complete context of what was discussed and decided so far.

    Set update_history=True for meaningful turns (architecture decisions,
    chat answers, summaries). Leave False for internal routing calls like
    intent classification that shouldn't pollute the conversation.
    """
    import os, traceback
    api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    import logging as _log
    _logger = _log.getLogger(__name__)
    _logger.info("[DeepSeek] call_deepseek invoked, key present=%s session=%s", bool(api_key), session_id)
    if not api_key:
        _logger.warning("[DeepSeek] DEEPSEEK_API_KEY not set — skipping LLM call")
        return ""
    try:
        import httpx

        history = get_session_history(session_id) if session_id else []
        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_prompt})

        payload = {
            "model": "deepseek-chat",
            "messages": messages,
            "temperature": 0.3,
            "max_tokens": 1500,
        }
        _logger.info(
            "[DeepSeek] sending request, history_turns=%d prompt_len=%d",
            len(history) // 2,
            len(user_prompt),
        )
        async with httpx.AsyncClient(timeout=45.0) as client:
            r = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
            _logger.info("[DeepSeek] response status=%d", r.status_code)
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"]
            _logger.info("[DeepSeek] response length=%d", len(content))

        if session_id and update_history and content:
            append_to_session(session_id, "user", user_prompt)
            append_to_session(session_id, "assistant", content)

        return content
    except Exception as exc:
        _logger.error("[DeepSeek] call failed: %s\n%s", exc, traceback.format_exc())
        return ""


async def validate_architecture(
    services: List[Service],
    connections: List[Connection],
) -> List[Warning]:
    """Generate validation warnings for common architecture issues."""
    warnings: List[Warning] = []
    service_types = {s.type for s in services}

    messaging_types = {
        "Azure Service Bus",
        "Azure Event Grid",
        "Azure Event Hubs",
        "Azure Queue Storage",
    }
    if len(services) >= 3 and not (service_types & messaging_types):
        affected = [s.id for s in services if "Functions" in s.type or "App Service" in s.type]
        warnings.append(
            Warning(
                severity="medium",
                category="tight_coupling",
                message=(
                    "No message queue detected. Adding Service Bus or Event Grid "
                    "would decouple producers and consumers."
                ),
                affected_services=affected,
                suggested_fix="Add Azure Service Bus or Azure Event Grid between compute and storage.",
            )
        )

    regions = {s.region for s in services}
    if len(regions) == 1 and len(services) >= 2:
        warnings.append(
            Warning(
                severity="medium",
                category="single_region",
                message=(
                    f"All services in {next(iter(regions))} — no geo-redundancy. "
                    "Consider adding a secondary region for HA."
                ),
                affected_services=[s.id for s in services],
                suggested_fix="Replicate critical services to a second Azure region.",
            )
        )

    critical_types = {
        "Azure Functions",
        "Azure App Service",
        "Azure Container Apps",
        "Azure Kubernetes Service",
    }
    messaging_types_set = {
        "Azure Service Bus",
        "Azure Event Grid",
        "Azure Event Hubs",
        "Azure Queue Storage",
    }
    has_messaging = bool(service_types & messaging_types_set)
    for t in critical_types:
        matching = [s for s in services if s.type == t]
        if len(matching) != 1:
            continue
        compute_id = matching[0].id
        incoming = [c for c in connections if c.target_id == compute_id]
        if not incoming:
            continue
        if not has_messaging:
            warnings.append(
                Warning(
                    severity="high",
                    category="single_point_of_failure",
                    message=(
                        f"Single instance of {t} handles all traffic — "
                        f"no messaging buffer in front (SPOF)."
                    ),
                    affected_services=[compute_id],
                    suggested_fix=(
                        "Add Service Bus, Event Grid, or Event Hubs in front "
                        "of the compute to buffer load."
                    ),
                )
            )

    if "Azure Cosmos DB" in service_types:
        cosmo = next(s for s in services if s.type == "Azure Cosmos DB")
        if not cosmo.config.get("multi_region"):
            warnings.append(
                Warning(
                    severity="low",
                    category="availability",
                    message=(
                        "Cosmos DB is not configured for multi-region writes. "
                        "Enable geo-replication if global reads are required."
                    ),
                    affected_services=[cosmo.id],
                    suggested_fix="Enable Cosmos DB multi-region writes.",
                )
            )

    if "Azure Functions" in service_types and "Azure Blob Storage" in service_types:
        fn = next(s for s in services if s.type == "Azure Functions")
        if "timeout" not in (fn.config or {}):
            warnings.append(
                Warning(
                    severity="low",
                    category="configuration",
                    message=(
                        "Azure Functions default timeout is 5 minutes. "
                        "Long image processing jobs may need an extended timeout."
                    ),
                    affected_services=[fn.id],
                    suggested_fix="Set function timeout to 10 minutes (max).",
                )
            )

    return warnings


def _cost_for_service(service: Service, req_per_min: float) -> float:
    """Compute a realistic monthly cost for a service given request load."""
    t = service.type
    cfg = service.config or {}
    req_per_month = req_per_min * 60 * 24 * 30  # ~43,200 min/month

    if t == "Azure Functions":
        free_req = 1_000_000
        free_gbs = 400_000
        exec_cost = max(0.0, req_per_month - free_req) * 0.0000002
        # Memory and duration scale with workload type:
        # image/video/AI processing needs more memory and time than a web API call
        runtime = str(cfg.get("runtime") or "")
        plan = str(cfg.get("plan") or cfg.get("planType") or "consumption")
        is_heavy = any(k in runtime.lower() for k in ("image", "vision", "ml", "ai")) or req_per_min >= 5_000
        mem_gb = 0.512 if is_heavy else 0.128
        duration_s = 2.0 if is_heavy else 0.3
        gbs = req_per_month * mem_gb * duration_s
        gbs_cost = max(0.0, gbs - free_gbs) * 0.000016
        return round(exec_cost + gbs_cost, 2)

    if t == "Azure App Service":
        plan = cfg.get("plan", "Basic")
        # Scale out instances based on load; each B1 handles ~1k req/min
        instances = max(1, int(req_per_min / 1000))
        plan_cost = {"Basic": 13.0, "Standard": 73.0, "Premium": 138.0, "consumption": 5.0}.get(plan, 13.0)
        return round(plan_cost * instances, 2)

    if t == "Azure Container Apps":
        # $0.000024/vCPU-s, $0.000003/GB-s; assume 0.5 vCPU, 1 GB, 200ms per req
        vcpu_cost = req_per_month * 0.5 * 0.2 * 0.000024
        mem_cost = req_per_month * 1.0 * 0.2 * 0.000003
        return round(vcpu_cost + mem_cost, 2)

    if t == "Azure Kubernetes Service":
        # Standard_D2s_v3 nodes at ~$70/node/month; 1 node per 10k req/min
        nodes = max(3, int(req_per_min / 10_000))
        return round(nodes * 70.0, 2)

    if t == "Azure Cosmos DB":
        # ~10 RU per request; min 400 RU/s; $0.008/100 RU/hr
        req_per_sec = req_per_min / 60.0
        ru_s = max(400.0, req_per_sec * 10)
        if cfg.get("serverless"):
            # $0.25 per million RUs
            return round((req_per_month * 10 / 1_000_000) * 0.25, 2)
        hourly = (ru_s / 100) * 0.008
        return round(hourly * 24 * 30, 2)

    if t == "Azure SQL Database":
        tier = cfg.get("tier", "Standard")
        if tier == "Basic" or req_per_min < 1000:
            return 5.0
        if tier == "Standard" or req_per_min < 10_000:
            return 30.0
        return 75.0

    if t == "Azure Blob Storage":
        tier = cfg.get("tier", "Hot")
        price_per_gb = {"Hot": 0.018, "Cool": 0.01, "Archive": 0.002}.get(tier, 0.018)
        # Assume avg 10 KB per stored object, accumulates over month
        storage_gb = max(1.0, req_per_month * 0.00001)
        ops_cost = (req_per_month / 10_000) * 0.004
        return round(storage_gb * price_per_gb + ops_cost, 2)

    if t == "Azure Event Hubs":
        # Standard: $10/TU/month (1 TU = 1000 events/sec); + $0.015/million events
        req_per_sec = req_per_min / 60.0
        tus = max(1, int(req_per_sec / 1000) + 1)
        event_cost = (req_per_month / 1_000_000) * 0.015
        return round(tus * 10.0 + event_cost, 2)

    if t == "Azure Service Bus":
        # Standard: $10/million operations
        return round((req_per_month / 1_000_000) * 10.0, 2)

    if t == "Azure Event Grid":
        # $0.60 per million events (first 100k free)
        billable = max(0.0, req_per_month - 100_000)
        return round((billable / 1_000_000) * 0.60, 2)

    if t == "Azure Queue Storage":
        return round((req_per_month / 1_000_000) * 0.004, 2)

    if t == "Azure API Management":
        # Developer $48, Basic $143 (up to 1M calls), Standard $729
        if req_per_min < 700:
            return 48.0
        if req_per_min < 7_000:
            return 143.0
        return 729.0

    if t == "Azure Front Door":
        # $35 base + $0.009/10k requests + $0.008/GB transfer (assume 1KB avg)
        req_cost = (req_per_month / 10_000) * 0.009
        data_gb = req_per_month * 0.000001
        return round(35.0 + req_cost + data_gb * 0.008, 2)

    if t == "Azure CDN":
        data_gb = req_per_month * 0.000001
        return round(data_gb * 0.087, 2)

    if t == "Azure OpenAI Service":
        # Model-aware pricing per 1K tokens (input / output)
        model = (cfg.get("model") or "gpt-4o").lower()
        if "o3" in model:
            price_in, price_out = 0.010, 0.040
        elif "gpt-4o" in model or "4o" in model:
            price_in, price_out = 0.005, 0.015
        elif "gpt-4" in model:
            price_in, price_out = 0.030, 0.060
        elif "35" in model or "3.5" in model:
            # gpt-3.5-turbo
            price_in, price_out = 0.0005, 0.0015
        else:
            price_in, price_out = 0.005, 0.015  # default to gpt-4o
        # Assume 1K input + 500 output tokens per request
        input_cost = (req_per_month / 1_000) * price_in
        output_cost = (req_per_month / 1_000) * 0.5 * price_out
        return round(input_cost + output_cost, 2)

    if t == "Azure AI Search":
        # Resolved via IQ at estimate time — see estimate_cost()
        # This fallback is only used if IQ is unavailable
        sku = (cfg.get("sku") or cfg.get("tier") or "basic").lower()
        replicas = int(cfg.get("replicas") or 1)
        if sku == "free":
            return 0.0
        su_monthly = {"basic": 73.73, "standard": 245.0, "standard2": 735.0, "standard3": 1471.0}.get(sku, 73.73)
        return round(su_monthly * replicas, 2)

    if t in ("Azure Monitor", "Application Insights"):
        # ~1.5 KB raw telemetry per execution; adaptive sampling kicks in at scale (~10:1)
        # effective = 150 bytes/req = 1.5e-7 GB/req
        # Azure gives 5 GB/month free
        gb_per_month = req_per_month * 1.5e-7
        billable_gb = max(0.0, gb_per_month - 5.0)
        return round(billable_gb * 2.76, 2)

    if t == "Azure Document Intelligence":
        # $1.50 per 1000 pages
        return round((req_per_month / 1_000) * 1.50, 2)

    if t == "Azure Table Storage":
        return round((req_per_month / 1_000_000) * 0.036, 2)

    # Fallback to catalog base_cost
    entry = next((e for e in SERVICE_CATALOG if e["type"] == t), None)
    return float(entry["base_cost"]) if entry else 5.0


async def estimate_cost(services: List[Service], req_per_min: float = 500.0) -> Dict[str, Any]:
    """Estimate monthly costs using IQ-grounded pricing where available.

    For each service we query Foundry IQ for its pricing document. All retrieved
    docs + service configs + req_per_min are bundled into a single DeepSeek call
    that returns accurate, scale-aware cost per service. Falls back to the
    formula-based _cost_for_service() for any service IQ can't price.
    """
    import asyncio
    import json as _json
    import logging as _log
    _logger = _log.getLogger(__name__)

    req_per_month = req_per_min * 60 * 24 * 30

    # Step 1 — fetch IQ pricing docs for all services in parallel
    iq_docs: Dict[str, Optional[str]] = {}
    iq_results = await asyncio.gather(
        *[query_pricing_iq(s.type) for s in services],
        return_exceptions=True,
    )
    for s, result in zip(services, iq_results):
        iq_docs[s.id] = result if isinstance(result, str) else None

    any_iq = any(v is not None for v in iq_docs.values())

    if any_iq:
        # Step 2 — build a single prompt with all context and ask DeepSeek
        service_lines = []
        for i, s in enumerate(services):
            cfg_str = _json.dumps(s.config or {})
            service_lines.append(f"{i+1}. {s.type} | name: {s.name} | config: {cfg_str}")

        pricing_sections = []
        for s in services:
            doc = iq_docs.get(s.id)
            if doc:
                pricing_sections.append(f"[{s.type}]\n{doc}")

        system = (
            "You are a precise Azure cloud cost estimator. "
            "Given pricing documentation retrieved from Azure docs and a list of services with their configs, "
            "calculate the accurate monthly cost for each service at the given request scale. "
            "Consider service config (tier, SKU, replicas, model, plan) carefully. "
            "Return ONLY a JSON array — no markdown, no explanation. Each element:\n"
            '{"index": <1-based>, "type": "<service type>", "monthly_usd": <number>, "note": "<one short reason>"}'
        )
        user_prompt = (
            f"Scale: {req_per_min:,.0f} requests/minute ({req_per_month:,.0f} requests/month)\n\n"
            "Services to price:\n" + "\n".join(service_lines) + "\n\n"
            "Pricing documentation from Azure docs (Foundry IQ):\n" +
            "\n\n".join(pricing_sections) + "\n\n"
            "Return the JSON array of costs now."
        )

        raw = await call_deepseek(system, user_prompt)
        llm_costs: Dict[int, float] = {}

        if raw:
            raw = raw.strip()
            if raw.startswith("```"):
                raw = "\n".join(raw.split("\n")[1:])
                raw = raw.rsplit("```", 1)[0].strip()
            try:
                items = _json.loads(raw)
                if isinstance(items, list):
                    for item in items:
                        idx = int(item.get("index", 0))
                        cost = float(item.get("monthly_usd", 0))
                        if idx > 0:
                            llm_costs[idx] = cost
                            _logger.info("[IQ pricing] service #%d → $%.2f/mo (IQ+LLM)", idx, cost)
            except Exception as exc:
                _logger.warning("[IQ pricing] failed to parse LLM cost response: %s", exc)

        # Step 3 — merge: use LLM cost where available, formula fallback otherwise
        per_service = []
        for i, s in enumerate(services):
            cost = llm_costs.get(i + 1) or _cost_for_service(s, req_per_min)
            if i + 1 not in llm_costs:
                _logger.info("[IQ pricing] %s → $%.2f/mo (formula fallback)", s.type, cost)
            s.cost_estimate = round(cost, 2)
            per_service.append({"type": s.type, "name": s.name, "monthly": s.cost_estimate})
    else:
        # No IQ available — use formulas for everything
        _logger.info("[IQ pricing] IQ unavailable for all services — using formula estimator")
        per_service = []
        for s in services:
            cost = round(_cost_for_service(s, req_per_min), 2)
            s.cost_estimate = cost
            per_service.append({"type": s.type, "name": s.name, "monthly": cost})

    total = round(sum(p["monthly"] for p in per_service), 2)
    return {
        "monthly_total": total,
        "per_service": per_service,
        "currency": "USD",
        "req_per_min": req_per_min,
    }


async def estimate_performance(
    services: List[Service],
    connections: List[Connection],
    req_per_min: float = 500.0,
) -> Dict[str, Any]:
    service_types = {s.type for s in services}
    has_async = any(c.type in {"async", "event-driven"} for c in connections)
    n_compute = sum(
        1 for s in services
        if s.type in {"Azure Functions", "Azure App Service", "Azure Container Apps", "Azure Kubernetes Service"}
    )

    # Latency — based on architecture shape
    if "Azure Front Door" in service_types:
        base_latency = 40
    elif "Azure Kubernetes Service" in service_types:
        base_latency = 80
    elif "Azure Container Apps" in service_types:
        base_latency = 90
    elif "Azure App Service" in service_types:
        base_latency = 120
    else:
        base_latency = 60  # Functions cold-path already counted below

    # Cold start penalty for Functions
    if "Azure Functions" in service_types:
        base_latency += 150

    # DB overhead
    if "Azure Cosmos DB" in service_types:
        base_latency += 15
    elif "Azure SQL Database" in service_types:
        base_latency += 30

    # Async queue adds latency
    if has_async:
        base_latency += 20

    # Load pressure increases p95 latency
    if req_per_min >= 100_000:
        base_latency = int(base_latency * 1.8)
    elif req_per_min >= 10_000:
        base_latency = int(base_latency * 1.3)

    latency = f"{base_latency}ms"

    # Throughput — based on compute + async
    if "Azure Event Hubs" in service_types and has_async:
        raw_tput = min(req_per_min * 60, 100_000 * 60)  # cap at Event Hubs max
        throughput = f"{int(raw_tput):,} events/hr"
    elif "Azure Kubernetes Service" in service_types:
        throughput = f"{int(req_per_min * 60):,} req/hr"
    else:
        throughput = f"{int(req_per_min * 60):,} req/hr"

    return {
        "latency_p95": latency,
        "throughput": throughput,
        "compute_units": n_compute,
    }


def build_architecture_metadata(
    services: List[Service],
    connections: List[Connection],
    cost: Dict[str, Any],
    perf: Dict[str, Any],
) -> ArchitectureMetadata:
    return ArchitectureMetadata(
        estimated_cost_monthly=float(cost.get("monthly_total", 0.0)),
        estimated_latency_p95=str(perf.get("latency_p95", "")),
        estimated_throughput=str(perf.get("throughput", "")),
        regions=sorted({s.region for s in services}),
    )
