# ArchMind — AI Architecture Reasoning on Microsoft Foundry

An AI agent that reasons through Azure system design decisions in real time, rendering its thinking as an auto-updating interactive canvas. You describe what you want to build. ArchMind reasons through every tradeoff, selects the right Azure services, flags failure risks, simulates performance, and estimates cost — live, as you watch.

**The reasoning chain is the product. The canvas is the output.**

> **Model provider note:** ArchMind is built against an Azure OpenAI / Microsoft Foundry-compatible chat-completions interface. For development and cost efficiency, the deployed model is DeepSeek-V3 (also OpenAI-compatible) — prompts, tool-calling pattern, the LangGraph reasoning flow, and Foundry IQ grounding are all unchanged. Swapping the active model to Azure OpenAI GPT-4o is a one-line change to the chat-completions client (`call_deepseek` in `app/agent/tools.py`); the `azure_openai_*` settings in `app/config.py` are the prepared swap point.

---

## 🎥 Demo

> _[YouTube link — coming soon]_

---

## ✨ What Makes This Different

- **Not a diagramming tool.** You don't drag boxes. The agent decides the architecture and the canvas updates automatically.
- **Not a chatbot.** Every message in the chat panel is a reasoning step — service selection rationale, tradeoff explanation, self-correction — not a generated response.
- **Reasoning-first UX.** Watching the agent think through "why Azure Functions over App Service for this workload" as nodes appear on the canvas is the core experience. No other tool exposes the reasoning chain this way.

---

## 🚀 Quick Start

### Prerequisites
- Docker Desktop
- Docker Compose
- Azure credentials (or run in mock mode without them)

```bash
git clone <repo-url>
cd AzureAgentLeague

# Copy and fill in Azure credentials (or leave blank for mock mode)
cp .env.example .env

# Start everything
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Other commands

```bash
docker-compose up -d          # run in background
docker-compose logs -f        # tail logs
docker-compose down           # stop
docker-compose down -v        # stop and remove volumes
```

---

## 🧠 How It Works

Every user message runs through a LangGraph state machine. The reasoning steps stream live to the chat panel as they execute:

```
parse → clarify? → query Foundry IQ → reason → validate → self-correct → estimate → summarize → output
```

| Step | What happens |
|------|-------------|
| **Parse** | Detects workload type, region, scale, refinement intent |
| **Clarify** | Asks for missing info before proceeding (workload / scale / region) |
| **Query Foundry IQ** | Retrieves real Azure docs, pricing data, and known patterns from Azure AI Search |
| **Reason** | Calls the LLM with Foundry IQ context to select the right Azure services and explain each choice |
| **Validate** | Checks for single points of failure, tight coupling, single-region risk |
| **Self-correct** | Automatically fixes high-severity issues (adds Service Bus for SPOF, replicates to secondary region for HA) |
| **Estimate** | Calculates monthly cost and p95 latency/throughput per service |
| **Summarize** | LLM generates a plain-English architecture summary covering decisions, tradeoffs, and risks |
| **Output** | Canvas auto-layouts with Dagre, cost badges appear on nodes, metadata panel updates |

Refinements ("make it cheaper", "add redundancy") re-run the full pipeline with the existing architecture passed as context — the LLM decides what to keep, change, or add.

---

## 🎯 Core Features

- **Natural language → architecture** — describe what you want, the agent designs it
- **Live reasoning stream** — every decision step visible in the chat panel as it happens
- **Tradeoff explanations** — agent flags "you want low latency but chose a far region — here's the fix"
- **Failure simulation** — select any node, click "Simulate Failure", watch cascading impact propagate across the canvas
- **Self-correction** — agent catches SPOFs, bad patterns, and anti-patterns automatically
- **Iterative refinement** — "make it more cost efficient" → agent re-reasons, explains what it's sacrificing
- **Cost + performance estimates** — real monthly cost breakdown and latency/throughput projections
- **Architecture summary** — LLM-generated plain-English summary after every generation
- **Manual canvas** — drag services from the catalog, wire connections, re-validate
- **Export** — JSON (for IaC tools) and PNG (for design docs)

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Agent framework | LangGraph |
| LLM | Foundry-compatible chat-completions API (DeepSeek-V3 in this deployment for cost efficiency; one-line swap to Azure OpenAI GPT-4o) |
| Knowledge grounding | Azure AI Search (Foundry IQ) |
| Backend | Python + FastAPI + WebSocket |
| Frontend | React + React Flow + Zustand |
| Canvas layout | Dagre auto-layout |
| Dev tooling | GitHub Copilot, Docker |

---

## 🏆 Hackathon Tracks

### Track 1 — Creative Apps with GitHub Copilot

ArchMind is a reasoning-first creative application built entirely with GitHub Copilot as the primary development accelerant. The visual UX — watching an agent's reasoning chain render as an architecture canvas in real time — is something no existing tool does.

**GitHub Copilot contributions:**
- **LangGraph state machine** — Copilot suggested the conditional edge routing pattern for `parse → clarify → query → reason → validate → self_correct → estimate → output`
- **WebSocket streaming protocol** — Copilot completed the event dispatch loop, step-to-event mapping, and reconnection logic
- **React Flow canvas** — Copilot generated the Dagre auto-layout integration and all custom node component structure
- **Failure simulation BFS** — Copilot completed the breadth-first cascade traversal from a partial implementation
- **Cost normalization logic** — Copilot caught the delta-based footgun and suggested the catalog-as-source-of-truth pattern

The entire 4-service stack was built in under a week. Without Copilot, this build would have taken 2–3x longer.

### Track 2 — Reasoning Agents with Microsoft Foundry

ArchMind is grounded in real Azure data through Foundry IQ (Azure AI Search). The agent doesn't hallucinate service capabilities — it retrieves specs, pricing tables, architecture patterns, and known failure modes before reasoning. The agent runs against a Foundry-compatible chat-completions interface (currently DeepSeek-V3 for cost efficiency, swappable to Azure OpenAI GPT-4o — see the Model provider note above); the reasoning flow, tool-calling, and IQ-grounding pattern are identical either way.

**Foundry IQ grounding covers:**
- Azure service specifications and limits
- Regional pricing data per service tier
- Known architecture patterns (event-driven, microservices, serverless, streaming)
- Common failure modes and mitigation patterns

Every architecture decision the agent makes is traceable to a retrieved document — directly targeting the Reliability & Safety judging criterion.

### Bonus — Best Use of IQ Tools

Foundry IQ is load-bearing in every generation. The `query` step retrieves context before the LLM reasons, so service selection is grounded in real data rather than model weights. The IQ context is passed explicitly to the LLM prompt and visible in the reasoning stream.

---

## 📁 Project Structure

```
AzureAgentLeague/
├── docker-compose.yml
├── .env.example
├── services/
│   ├── backend/                  # Python FastAPI + LangGraph agent
│   │   ├── app/
│   │   │   ├── agent/
│   │   │   │   ├── graph.py      # LangGraph state machine
│   │   │   │   ├── nodes.py      # Node implementations
│   │   │   │   ├── streaming.py  # WebSocket event emitter
│   │   │   │   ├── state.py      # AgentState TypedDict
│   │   │   │   └── tools.py      # Foundry IQ, cost/perf estimators
│   │   │   ├── api/
│   │   │   │   └── websocket.py  # WS session handler
│   │   │   └── models/
│   │   │       └── domain.py     # Pydantic models
│   └── frontend/                 # React app
│       └── src/
│           ├── components/
│           │   └── architecture/ # Canvas, ChatPanel, MetadataPanel, nodes
│           ├── hooks/            # useWebSocket, useSession
│           ├── stores/           # Zustand architecture store
│           └── lib/              # Layout engine, service catalog, WS client
└── specs/                        # Design docs and track playbooks
```

---

## 📝 License

MIT

---

**Built for Microsoft Agents League @ AI Skills Fest · June 2026**
