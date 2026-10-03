# AI Scrum Master: Autonomous Multi-Agent Delivery Cockpit

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
│   ├── seed_project_data.py     # Multi-project sample data preloader
│   └── setup_local_env.sh       # Local virtualenv and dependencies setup
├── cloudbuild.yaml              # Cloud Build CI/CD pipeline
├── docker-compose.yaml          # Multi-container local orchestration
└── README.md
```

---

## ⚡ Quick Start (Local Development)

### 1. Initialize Local Environment
```bash
chmod +x scripts/setup_local_env.sh && ./scripts/setup_local_env.sh
```

### 2. Run Local Multi-Container Stack
```bash
docker compose up --build
```
- **Web Cockpit:** [http://localhost:3000](http://localhost:3000)
- **FastAPI Backend & Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Health Check:** [http://localhost:8000/healthz](http://localhost:8000/healthz)

### 3. Preload Sample Multi-Project Data
```bash
python scripts/seed_project_data.py
```
This preloads two projects:
1. `Customer Claims Automation` (Standalone Mode with GitHub & NotebookLM)
2. `FinTech Payment Modernization` (Enterprise Sync Mode with Jira & Confluence)

---

## ☁️ Google Cloud Deployment (Cloud Run)

### 1. Bootstrap GCP Project & Infrastructure
```bash
chmod +x scripts/bootstrap_gcp.sh
./scripts/bootstrap_gcp.sh <YOUR_GCP_PROJECT_ID> europe-west3
```

### 2. Deploy via Cloud Build
```bash
gcloud builds submit --config=cloudbuild.yaml --substitutions=_REGION=europe-west3
```
