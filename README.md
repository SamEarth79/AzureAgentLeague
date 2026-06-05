# ArchMind - AI-Powered Azure Architecture Reasoning

An intelligent agent that reasons through system architecture decisions and visualizes the thinking process on an interactive canvas.

## 🚀 Quick Start (Docker)

### Prerequisites
- Docker Desktop installed
- Docker Compose installed

### Development Setup

1. Clone repository:
```bash
git clone <repo-url>
cd AzureAgentLeague
```

2. Configure environment:
```bash
# Copy .env and fill in Azure credentials (or use mock mode)
cp .env.example .env
```

3. Start services:
```bash
docker-compose up --build
```

4. Access application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Development Commands

```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Rebuild containers
docker-compose up --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## 🎯 What It Does

User describes what they want to build in natural language. ArchMind:
1. Reasons through architecture decisions
2. Selects appropriate Azure/Foundry components
3. Visualizes architecture on interactive canvas
4. Explains tradeoffs and flags risks
5. Simulates performance and estimates costs
6. Handles iterative refinement

**Key differentiator:** The reasoning chain is the product. The canvas is the output.

## 🛠️ Tech Stack

- **Agent:** LangGraph + GPT-4o (Microsoft Foundry)
- **Knowledge:** Foundry IQ (Azure AI Search)
- **Backend:** Python + FastAPI
- **Frontend:** React + React Flow
- **Development:** Docker + GitHub Copilot

## 📁 Project Structure

```
AzureAgentLeague/
├── docker-compose.yml          # Docker orchestration
├── .env                        # Environment variables
├── services/
│   ├── backend/                # Python FastAPI service
│   │   ├── Dockerfile.dev
│   │   ├── requirements.txt
│   │   └── app/
│   └── frontend/               # React application
│       ├── Dockerfile.dev
│       ├── package.json
│       └── src/
└── specs/                      # Technical specifications
    ├── system-design.md
    ├── agent-design.md
    └── progress.md
```

## 🏆 Hackathon Tracks

Participating in 3 tracks:
- **Creative Apps with GitHub Copilot** - Reasoning-first UX
- **Reasoning Agents with Microsoft Foundry** - Deep agent reasoning
- **Best Use of IQ Tools** - Foundry IQ grounding

## 📝 License

MIT

---

**Built for Microsoft Agents League @ AI Skills Fest**
