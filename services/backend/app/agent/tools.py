"""Mock tools for the ArchMind agent.

These mimic the shape of real LangChain tools the agent will eventually call
(Foundry IQ queries, cost/performance estimation, validation) but return
deterministic data. Replace these with real tool implementations when Azure
OpenAI and Foundry IQ are wired up.
"""
from __future__ import annotations

import hashlib
import re
from typing import Any, Dict, List, Optional

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
    import os
    # use_mock = os.environ.get("USE_MOCK_FOUNDRY_IQ", "false").lower() == "true"
    use_mock = False
    if not use_mock:
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
                    print(f"[DEBUG] parts: {parts}")
                    return "FoundryIQ retrieved:\n" + "\n\n".join(parts)
            except Exception:
                pass  # fall through to mock on any search error

    return _mock_foundry_iq(query)


async def call_deepseek(system_prompt: str, user_prompt: str) -> str:
    """Call DeepSeek V3 via OpenAI-compatible API. Returns response text or empty string on error."""
    import os, traceback
    api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    import logging as _log
    _logger = _log.getLogger(__name__)
    _logger.info("[DeepSeek] call_deepseek invoked, key present=%s", bool(api_key))
    if not api_key:
        _logger.warning("[DeepSeek] DEEPSEEK_API_KEY not set — skipping LLM call")
        return ""
    try:
        import httpx
        payload = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 1500,
        }
        _logger.info("[DeepSeek] sending request, prompt length=%d", len(user_prompt))
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
            return content
    except Exception as exc:
        _logger.error("[DeepSeek] call failed: %s\n%s", exc, traceback.format_exc())
        return ""


async def get_service_catalog(category: Optional[str] = None) -> List[Dict[str, Any]]:
    if category is None:
        return list(SERVICE_CATALOG)
    return [s for s in SERVICE_CATALOG if s["category"] == category]


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


async def select_service(
    service_type: str,
    config: Optional[Dict[str, Any]] = None,
    reasoning: str = "",
) -> Service:
    """Construct a Service model. Looks up base cost from the catalog."""
    entry = next((s for s in SERVICE_CATALOG if s["type"] == service_type), None)
    if entry is None:
        raise ValueError(f"Unknown service type: {service_type}")
    return Service(
        id=f"svc-{_slug(service_type)}",
        type=service_type,
        name=service_type.replace("Azure ", ""),
        config=config or {},
        reasoning=reasoning or f"Selected {service_type} based on requirements.",
        cost_estimate=float(entry["base_cost"]),
        region="eastus",
    )


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


async def estimate_cost(services: List[Service]) -> Dict[str, Any]:
    total = sum(s.cost_estimate or 0.0 for s in services)
    return {
        "monthly_total": round(total, 2),
        "per_service": [
            {"type": s.type, "monthly": s.cost_estimate or 0.0} for s in services
        ],
        "currency": "USD",
    }


async def estimate_performance(
    services: List[Service],
    connections: List[Connection],
) -> Dict[str, Any]:
    service_types = {s.type for s in services}
    has_async = any(c.type in {"async", "event-driven"} for c in connections)
    n_compute = sum(
        1
        for s in services
        if s.type
        in {
            "Azure Functions",
            "Azure App Service",
            "Azure Container Apps",
            "Azure Kubernetes Service",
        }
    )

    if "Azure Front Door" in service_types:
        latency = "120ms (global edge)"
    elif "Azure Container Apps" in service_types or "Azure Kubernetes Service" in service_types:
        latency = "300ms"
    elif "Azure App Service" in service_types:
        latency = "450ms"
    else:
        latency = "800ms"

    if has_async and "Azure Event Hubs" in service_types:
        throughput = "100k events/sec"
    elif "Azure Container Apps" in service_types:
        throughput = "5k req/sec"
    elif "Azure Kubernetes Service" in service_types:
        throughput = "20k req/sec"
    else:
        throughput = "1k req/sec"

    if "Azure Cosmos DB" in service_types:
        throughput += " (DB-limited)"

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
        compliance=[],
        failure_scenarios=[
            "Compute cold start under burst load",
            "Storage throttling under high concurrency",
        ],
    )
