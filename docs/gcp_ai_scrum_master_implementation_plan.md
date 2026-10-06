# AI Scrum Master: Dual-Mode (Standalone & Enterprise) with Google NotebookLM Knowledge Center & GitHub Tracking Plan

## 1. Executive Summary & Architectural Vision
The **AI Scrum Master** provides a flexible, dual-mode operational architecture designed to support organizations of any size, integrating **Google NotebookLM** as the project-specific grounded knowledge engine:

1. **Google NotebookLM Project Knowledge Center:**
   - Every project maintains its own dedicated **Google NotebookLM Knowledge Workspace** (`notebooklm.google.com/notebook/{notebook_id}`).
   - Project sources (PRDs, optical layout extracts, meeting notes, architectural decision records [ADRs], retrospective kaizen logs) are indexed to provide **NotebookLM-style grounded Q&A with exact citations, source snippets, and audio briefing summaries**.
   - Direct integration: Seamless one-click access to the project's NotebookLM workspace, auto-syncing of project artifacts to NotebookLM-compatible formats, and in-app grounded search powered by **Vertex AI Search & Gemini**.
2. **Standalone / Native Mode (Zero External Tools Required + GitHub Tracking):**
   - For organizations without Jira or Confluence.
   - **100% self-contained for Agile delivery**:
     - Backlogs, Epics, User Stories, Subtasks, Sprint Planning, and interactive Kanban boards are managed natively within **Google Cloud Firestore**.
     - Living documentation is maintained in the native **Document Studio & NotebookLM Knowledge Center**.
     - **Direct GitHub / GHE Integration:** Standalone projects link to a GitHub repository (`owner/repo`). Developer commits and PRs tagged with native task keys (`TSK-101`, `STY-204`) are parsed to compute the real-time **Flash Health Indicator** (🟢 **ON-TRACK**, 🟡 **AT-RISK**, 🔴 **OFF-TRACK**).
     - **Zero Atlassian license or third-party dependency required.**
3. **Enterprise Integrated Mode (Jira + Confluence + GitHub + NotebookLM):**
   - For organizations using Atlassian Jira and Confluence.
   - Backlog items sync bidirectionally with dedicated Jira Project Keys (`CLM`, `FIN`, etc.).
   - Living documentation syncs with dedicated Confluence Spaces.
   - GitHub commits and pull requests tagged with Jira issue keys trigger the real-time **Flash Health Indicator**.
   - Project knowledge is unified and synced with Google NotebookLM.
4. **Google Cloud Platform (The Multi-Agent AI Core & Audit Ledger):**
   - **Vertex AI (Gemini 3 Flash / Pro) + ADK:** 7 specialized agents (Orchestrator, Understanding, Ambiguity, Backlog, Sprint, Meeting, Risk).
   - **Document AI:** OCR and hierarchical layout parsing.
   - **Vertex AI Search:** Grounded semantic search mirroring NotebookLM's citation engine.
   - **Cloud Firestore:** Multi-project state, 3-tier governance approval ledger (*Auto-execute, Approval Required, Human-Only*), and immutable activity audit history.
   - **BigQuery:** Sprint snapshots, velocity trends, cycle times, and predictive spillover analytics.

---

## 2. Pluggable Dual-Mode & NotebookLM Architecture

```text
                                  PROJECT SETTINGS
                 ┌─────────────────────────────────────────────────┐
                 │ Project Mode: [ Standalone | Enterprise Sync ]  │
                 │ Google NotebookLM URL: notebooklm.google.com/.. │
                 │ GitHub Repo: owner/repo                         │
                 └────────────────────────┬────────────────────────┘
                                          │
            ┌─────────────────────────────┴─────────────────────────────┐
            ▼                                                           ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────────┐
│     MODE A: STANDALONE (NATIVE)       │   │    MODE B: ENTERPRISE INTEGRATED      │
│  (Native Scrum + Direct GitHub Read)  │   │     (Jira + Confluence + GitHub)      │
├───────────────────────────────────────┤   ├───────────────────────────────────────┤
│ • Native Firestore Backlog & Epics    │   │ • Atlassian Jira Cloud REST API v3    │
│ • Native Firestore Sprint Kanban      │   │ • Atlassian Confluence Cloud REST v2  │
│ • Native Studio & Requirements        │   │ • Dedicated Jira Project Keys         │
│ • Native Team Capacity & Members      │   │ • Dedicated Confluence Spaces         │
│                                       │   │ • Multi-Project Enterprise Sync       │
│ ┌───────────────────────────────────┐ │   │ ┌───────────────────────────────────┐ │
│ │  GitHub / GHE Activity Tracker    │ │   │ │  GitHub / GHE Activity Tracker    │ │
│ │  - Reads Commits & PRs (TSK-*)    │ │   │ │  - Reads Commits & PRs (JIRA-*)   │ │
│ │  - Computes Flash Health (🟢🟡🔴)  │ │   │ │  - Computes Flash Health (🟢🟡🔴)  │ │
│ └───────────────────────────────────┘ │   │ └───────────────────────────────────┘ │
└───────────────────┬───────────────────┘   └───────────────────┬───────────────────┘
                    │                                           │
                    └─────────────────────┬─────────────────────┘
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│              GOOGLE NOTEBOOKLM PROJECT KNOWLEDGE CENTER                           │
│                                                                                   │
│  • Dedicated Project NotebookLM Workspace (URL & ID)                              │
│  • Grounded Source Documents: PRD PDFs, Meeting Transcripts, Decisions, ADRs      │
│  • Vertex AI Search & Gemini Grounded Q&A with Exact Citations & Snippets         │
│  • NotebookLM Audio Overview & Executive Briefing Summaries                       │
│  • One-Click Sync / Export of Project Artifacts to NotebookLM                     │
└─────────────────────────────────────────┬─────────────────────────────────────────┘
                                          │
                                          ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                 CORE GCP MULTI-AGENT ENGINE & AUDIT TELEMETRY                     │
│                                                                                   │
│  • Vertex AI (Gemini 3 Flash/Pro) Multi-Agent ADK Orchestrator                     │
│  • Document AI Layout Parser (OCR & Clause Extraction)                            │
│  • Cloud Firestore (Multi-Project Tenancy, 3-Tier Governance, Immutable History)  │
│  • BigQuery (Historical Delivery Analytics, Cycle Times & Spillover Prediction)   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Pluggable Service Provider Interfaces

1. **`BacklogProvider`**:
   - `NativeFirestoreBacklogProvider`: Stores and queries epics, stories, and tasks directly in Cloud Firestore.
   - `JiraBacklogProvider`: Connects to Jira Cloud REST API v3 to read/create/update issues.
2. **`DocumentationProvider`**:
   - `NativeFirestoreDocProvider`: Stores PRDs, decisions, and meeting notes in Firestore and Cloud Storage.
   - `ConfluenceDocProvider`: Publishes and reads pages from Confluence Cloud REST API v2.
3. **`GitTrackerProvider` (Active in BOTH Modes)**:
   - `GitHubTrackerProvider`: Reads live GitHub / GHE commit history and PR statuses. Matches commit tags against either native task IDs (`TSK-101`, `STY-204`) or Jira keys (`CLM-101`) to compute Flash Health (🟢 ON-TRACK, 🟡 AT-RISK, 🔴 OFF-TRACK).
   - `NativeGitTrackerProvider`: Graceful fallback if no GitHub repository has been configured yet.
4. **`NotebookLMKnowledgeProvider`**:
   - Manages project NotebookLM workspace configuration, source document registries, grounded semantic search via Vertex AI Search (with exact source citation attribution), and sync/export payloads.
5. **`ProviderFactory`**:
   - Instantiates the correct provider dynamically based on the project's `project_mode` (`"STANDALONE"` vs `"ENTERPRISE_SYNC"`).

---

## 4. Monorepo Directory Layout

```
ai-scrum-master/
├── .github/
│   └── workflows/
│       ├── pr-validation.yaml          # Lint, unit tests, agent schema validation
│       └── release-deploy.yaml         # Build and deploy to GCP Cloud Run
├── apps/
│   ├── web/                            # Next.js 15+ / React 19 Frontend Cockpit
│   │   ├── src/
│   │   │   ├── app/                    # App Router routes (/dashboard, /documents, /backlog, etc.)
│   │   │   ├── components/             # UI Components (Radix UI, Tailwind CSS, Lucide icons)
│   │   │   │   ├── canvas/             # Native & Jira Kanban board + Dependency DAG
│   │   │   │   ├── copilot/            # Assistant chat drawer (⌘J)
│   │   │   │   ├── governance/         # Action Center, Approval Ledger, Activity Audit Log
│   │   │   │   ├── studio/             # Document Studio & Open Questions cards
│   │   │   │   ├── knowledge/          # NotebookLM Knowledge Hub & Grounded Citation search
│   │   │   │   ├── git/                # GitHub Flash Health banners & Commit tracker (Active in both modes)
│   │   │   │   └── navigation/         # Project Switcher & Project Creation modal (Mode & NotebookLM setup)
│   │   │   ├── hooks/                  # TanStack Query & dynamic project state hooks
│   │   │   └── lib/                    # API client & mode helpers
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   │
│   └── api/                            # Core FastAPI Backend & Orchestration Service
│       ├── src/
│       │   ├── api/                    # REST routes
│       │   │   ├── projects.py         # Multi-project CRUD, mode & NotebookLM workspace config
│       │   │   ├── ingest.py           # Document AI PRD parsing (Native & Confluence)
│       │   │   ├── backlog.py          # Unified backlog endpoints (Native & Jira)
│       │   │   ├── sprints.py          # Unified sprint endpoints (Native & Jira)
│       │   │   ├── meetings.py         # Meeting intelligence (Standup, Review, Retro)
│       │   │   ├── risks.py            # Critical-path DAG & 5D Health Matrix
│       │   │   ├── git_tracker.py      # GitHub tracking & Flash Health engine (Active in both modes)
│       │   │   ├── governance.py       # 3-tier approvals, action ledger, audit trail
│       │   │   ├── knowledge.py        # NotebookLM Knowledge Center & Grounded Q&A search
│       │   │   ├── reports.py          # BigQuery delivery analytics & trends
│       │   │   └── simulator.py        # E2E 4-step pipeline simulator
│       │   ├── core/                   # Integrations & Provider Abstractions
│       │   │   ├── config.py           # Configuration & environment variables
│       │   │   ├── provider_factory.py # Dynamically resolves Standalone vs Enterprise providers
│       │   │   ├── providers/          # Pluggable backends
│       │   │   │   ├── backlog/        # NativeFirestoreBacklogProvider & JiraBacklogProvider
│       │   │   │   ├── doc/            # NativeFirestoreDocProvider & ConfluenceDocProvider
│       │   │   │   └── git/            # GitHubTrackerProvider & NativeGitTrackerProvider
│       │   │   │   └── notebooklm/     # NotebookLMKnowledgeProvider & VertexSearchClient
│       │   │   ├── firestore_client.py # Firestore connector (Dual-mode Cloud/Local)
│       │   │   ├── bigquery_client.py  # BigQuery connector (Dual-mode Cloud/Local)
│       │   │   ├── vertex_client.py    # Vertex AI Gemini 3 Flash / Pro client
│       │   │   ├── documentai_client.py# Document AI Layout Parser client
│       │   │   └── flash_engine.py     # Flash Health status calculator
│       │   ├── schemas/                # Pydantic v2 domain schemas (ProjectMode, NotebookLMSettings, etc.)
│       │   └── main.py                 # FastAPI application entrypoint
│       ├── Dockerfile
│       ├── pyproject.toml
│       └── requirements.txt
│
├── packages/
│   ├── agents/                         # Vertex AI ADK Multi-Agent Definitions
│   │   ├── src/
│   │   │   ├── orchestrator.py         # Workflow controller & governance gate
│   │   │   ├── understanding_agent.py  # PRD semantic analysis & Persona extraction
│   │   │   ├── ambiguity_agent.py      # Open Questions Engine (FR-03)
│   │   │   ├── backlog_agent.py        # 4-tier decomposition & Gherkin ACs
│   │   │   ├── sprint_agent.py         # Capacity modeling, 10% risk buffer, sprint goals
│   │   │   ├── meeting_agent.py        # Standup, Review, and Retro entity extraction
│   │   │   ├── risk_agent.py           # Dependency DAG builder & 5D Health evaluator
│   │   │   ├── git_agent.py            # Commit & PR drift analyzer for Flash Health
│   │   │   └── prompts/                # Versioned System & Few-Shot Prompts
│   │   └── pyproject.toml
│   │
│   └── database/                       # Shared Database Layer
│       ├── firestore/
│       │   ├── firestore.rules         # Security rules supporting native and integrated modes
│       │   └── firestore.indexes.json  # Multi-tenant composite indexes
│       └── bigquery/
│           ├── tables/
│           │   ├── sprint_snapshots.json
│           │   ├── task_cycle_times.json
│           │   └── git_commit_telemetry.json
│           └── queries/
│               ├── spillover_risk_trend.sql
│               ├── velocity_cycle_time.sql
│               └── git_velocity_correlation.sql
│
├── infra/                              # Infrastructure as Code (Terraform)
│   ├── terraform/
│   │   ├── environments/dev/
│   │   ├── environments/prod/
│   │   └── modules/ (cloud_run, document_ai, firestore, bigquery, storage, iam, vertex_ai)
│
├── scripts/
│   ├── bootstrap_gcp.sh                # Provision GCP APIs, Artifact Registry, Terraform
│   ├── seed_project_data.py            # Preloads Standalone project with GitHub & NotebookLM + Enterprise project
│   └── setup_local_env.sh              # Local development initializer
│
├── cloudbuild.yaml                     # Automated CI/CD pipeline
├── docker-compose.yaml                 # Local multi-container development environment
└── README.md
```

---

## 5. Phased Implementation Plan

| Phase | Tasks & Artifacts |
|---|---|
| **Phase 1: Schemas & Database** | 1. Define Pydantic models with `ProjectMode` (`STANDALONE`, `ENTERPRISE_SYNC`), `GitSettings`, and `NotebookLMSettings`.<br>2. Define Firestore security rules & composite indexes.<br>3. Define BigQuery schemas & analytics queries. |
| **Phase 2: Pluggable Providers** | 1. Implement `NativeFirestoreBacklogProvider` and `JiraBacklogProvider`.<br>2. Implement `NativeFirestoreDocProvider` and `ConfluenceDocProvider`.<br>3. Implement `GitHubTrackerProvider` (active for both modes) and `NativeGitTrackerProvider`.<br>4. Implement `NotebookLMKnowledgeProvider` with grounded citations.<br>5. Implement `ProviderFactory` and `FlashEngine`. |
| **Phase 3: Vertex AI ADK Agents** | 1. Implement `orchestrator.py` (coordinates multi-project workflow & governance).<br>2. Implement `understanding_agent.py`, `ambiguity_agent.py`, `backlog_agent.py`, `sprint_agent.py`, `meeting_agent.py`, `risk_agent.py`, `git_agent.py`.<br>3. Configure Jinja prompts in `packages/agents/src/prompts/`. |
| **Phase 4: FastAPI REST API** | 1. Implement core clients (`firestore_client.py`, `bigquery_client.py`, `vertex_client.py`, `documentai_client.py`).<br>2. Implement REST routers: `projects.py`, `ingest.py`, `backlog.py`, `sprints.py`, `meetings.py`, `risks.py`, `git_tracker.py`, `governance.py`, `knowledge.py`, `reports.py`, `simulator.py`.<br>3. Mount routers & configure CORS in `main.py`. |
| **Phase 5: Next.js 15+ Web Cockpit** | 1. Setup Next.js 15 App Router, Tailwind CSS, Lucide icons, Radix UI.<br>2. Implement Project Switcher with Mode Badges (`STANDALONE` vs `ENTERPRISE SYNC`) and Creation modal with GitHub & NotebookLM link setup.<br>3. Implement Views: `/dashboard` (with Flash Health banner), `/documents`, `/backlog`, `/planning`, `/sprint` (Kanban), `/meetings`, `/risks` (DAG), `/governance` (Audit log), `/knowledge` (NotebookLM Workspace & Grounded Search with citations), `/reports` (BigQuery charts).<br>4. Implement Copilot Drawer (`⌘J`) and E2E Simulator. |
| **Phase 6: Infrastructure & CI/CD** | 1. Implement Terraform modules and `environments/prod`, `environments/dev`.<br>2. Create `scripts/bootstrap_gcp.sh`, `scripts/seed_project_data.py` (seeds 1 Standalone project with GitHub tracking & 1 Enterprise Sync project), `scripts/setup_local_env.sh`.<br>3. Configure `cloudbuild.yaml`, `docker-compose.yaml`, and root `README.md`. |
| **Phase 7: Testing & Verification** | 1. Agent reasoning unit tests: `packages/agents/tests/test_agents.py`.<br>2. Provider isolation tests (standalone with GitHub & NotebookLM vs enterprise): `apps/api/tests/test_providers.py`.<br>3. API router integration tests: `apps/api/tests/test_api.py`.<br>4. Flash Health and E2E verification test. |

---

## 6. Verification & Validation Strategy
1. **Google NotebookLM Integration Verification:** Verify that each project can link to its dedicated Google NotebookLM workspace, search across project documents with NotebookLM-style citations, and view audio/executive briefing summaries.
2. **Standalone Mode with GitHub Verification:** Create a new project in `STANDALONE` mode, configure a GitHub repo URL (e.g. `owner/repo`). Verify that commits tagged with native task keys (`TSK-301`, `STY-102`) are fetched and trigger the **Flash Health Indicator** (🟢 ON-TRACK / 🟡 AT-RISK / 🔴 OFF-TRACK).
3. **Enterprise Sync Mode Verification:** Create a project in `ENTERPRISE_SYNC` mode with Jira and Confluence configurations. Verify sync with Jira REST v3 and Confluence v2, with GitHub commit linking.
4. **Multi-Project Isolation:** Verify that switching between projects in the Web Cockpit seamlessly reloads the respective backlog, sprint board, documents, git feed, NotebookLM workspace, and audit history.
5. **Automated Test Suite:** Run `pytest packages/agents/tests apps/api/tests` to verify complete test pass rate.
