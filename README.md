# Orbit Maestro: Autonomous Multi-Agent Delivery Cockpit

An enterprise-grade, serverless multi-agent platform orchestrated on **Google Cloud Platform (GCP)**, **Atlassian Jira**, **Atlassian Confluence**, **GitHub**, and **Google NotebookLM**.

---

## 🚀 Key Architectural Capabilities

1. **Dual-Mode Multi-Project Operation:**
   - **Mode A: Standalone / Native Mode (Zero External Tools Required):** Self-contained agile delivery using **Cloud Firestore** for backlogs, epics, user stories, subtasks, sprint planning, and interactive Kanban boards.
   - **Mode B: Enterprise Integrated Mode:** Live bidirectional synchronization with **Atlassian Jira Cloud** (REST v3) and **Atlassian Confluence Cloud** (REST v2) using dedicated Project Keys (`CLM`, `FIN`, etc.) and Spaces.
2. **First-Class GitHub / GHE Integration (Both Modes):**
   - Connects directly to GitHub / GHE repositories to track commit frequency, pull request reviews, and branch aging linked to task/issue keys.
   - **Flash Health Engine:** Continuously evaluates git movement to display real-time **🟢 ON-TRACK**, **🟡 AT-RISK**, or **🔴 OFF-TRACK** status alerts (flags dormant tasks >48h and blocked PRs).
3. **Google NotebookLM Living Knowledge Center:**
   - Every project links to its dedicated **Google NotebookLM Workspace** (`notebooklm.google.com/notebook/...`).
   - In-app grounded semantic search powered by **Vertex AI Search & Gemini 3 Flash** returning answers with exact source snippets, page numbers, and citations.
   - Includes NotebookLM audio overview summaries and one-click artifact export.
4. **Vertex AI Agent Development Kit (ADK) Multi-Agent Loop:**
   - 7 specialized agents: **Orchestrator**, **Understanding**, **Ambiguity (Open Questions)**, **Backlog (Gherkin ACs)**, **Sprint Planner**, **Meeting Intelligence (Standup/Review/Retro)**, and **Risk Radar (Critical-Path DAG & 5D Health Matrix)**.
5. **3-Tier Governance & Immutable Audit Ledger:**
   - Enforces strict human control (*Auto-execute, Approval Required, Human-Only*) with an append-only audit trail in Firestore and BigQuery.

---

## 📁 Monorepo Structure

```
ai-scrum-master/
├── apps/
│   ├── web/                     # Next.js 15+ / React 19 Frontend Cockpit
│   └── api/                     # FastAPI Backend & ADK Orchestration Service
├── packages/
│   ├── agents/                  # Vertex AI ADK Multi-Agent Package
│   └── database/                # Firestore rules & BigQuery schemas
├── infra/
│   └── terraform/               # Enterprise Terraform Blueprint (prod, dev, modules)
├── scripts/
│   ├── bootstrap_gcp.sh         # Automated GCP provisioning script
│   └── setup_local_env.sh       # Local virtualenv and dependencies setup
├── cloudbuild.yaml              # Cloud Build CI/CD pipeline
├── docker-compose.yaml          # Multi-container local orchestration
└── README.md
```

---

## ⚡ Quick Start: Build & Run

> 📖 **Comprehensive Guide:** See [docs/BUILD_AND_RUN_GUIDE.md](docs/BUILD_AND_RUN_GUIDE.md) for full instructions covering Local Terminal, Gemini CLI, and Antigravity CLI.

### Option A: Local Terminal (Docker Compose)
```bash
# Build and start both API and Web UI
docker compose up --build
```
- **Web Cockpit:** [http://localhost:3000](http://localhost:3000)
- **FastAPI Backend & Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/healthz](http://localhost:8000/healthz)

### Option B: Local Native Development (Dual Process)
```bash
# 1. Setup Python virtualenv and frontend dependencies
chmod +x scripts/setup_local_env.sh && ./scripts/setup_local_env.sh

# 2. Terminal 1 (Backend):
source .venv/bin/activate
uvicorn apps.api.src.main:app --reload --port 8000

# 3. Terminal 2 (Frontend):
cd apps/web && npm run dev
```

### Option C: Gemini CLI
Launch the conversational agent in the repository to build, test, and diagnose:
```bash
gemini
```
*Prompt example:* `"Build the docker images, start the stack, and verify that all health checks pass."*

### Option D: Antigravity CLI (`agy`)
Launch the interactive agentic TUI:
```bash
# Install (macOS / Linux)
curl -fsSL https://antigravity.google/cli/install.sh | bash

# Launch TUI cockpit
agy
```

---

## ☁️ Google Cloud Deployment (Cloud Run)

### 1. Bootstrap GCP Project & Infrastructure
```bash
chmod +x scripts/bootstrap_gcp.sh
./scripts/bootstrap_gcp.sh <YOUR_GCP_PROJECT_ID> europe-west3
```

### 2. Deploy via Cloud Build
You can deploy directly using the automated script (which builds and deploys to Cloud Run without running local/CI test suites):
```bash
chmod +x scripts/run_cloud_build.sh
./scripts/run_cloud_build.sh <YOUR_GCP_PROJECT_ID> <REGION>
```

Or trigger `gcloud` manually:
```bash
gcloud builds submit --config=cloudbuild.yaml --substitutions=_REGION=us-central1
```
