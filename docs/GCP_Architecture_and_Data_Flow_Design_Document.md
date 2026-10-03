# Technical Design Document: AI Scrum Master GCP Architecture & Connectivity

**Project ID:** `ai-scrum-master-510116`  
**Primary Region:** `us-central1` (Council Bluffs, Iowa)  
**System Classification:** Enterprise-Grade Multi-Agent Autonomous Scrum Platform  
**Live Frontend Cockpit:** [https://ai-scrum-cockpit-a355sfc3uq-uc.a.run.app](https://ai-scrum-cockpit-a355sfc3uq-uc.a.run.app)  
**Live Core API:** [https://ai-scrum-api-a355sfc3uq-uc.a.run.app](https://ai-scrum-api-a355sfc3uq-uc.a.run.app)  
**API Documentation:** [https://ai-scrum-api-a355sfc3uq-uc.a.run.app/docs](https://ai-scrum-api-a355sfc3uq-uc.a.run.app/docs)  

---

## 1. Executive Summary & Architectural Principles

The **AI Scrum Master** platform is an autonomous, serverless, multi-agent system built on Google Cloud Platform (GCP). It transforms unstructured Product Requirements Documents (PRDs) into fully traceable Agile artifacts (Epics, User Stories with Gherkin Acceptance Criteria, Dev/QA Tasks), monitors delivery health via live GitHub telemetry, extracts standup blockers from meeting transcripts, forecasts sprint spillovers using Directed Acyclic Graphs (DAG), and maintains a living knowledge repository synchronized with Google NotebookLM.

### Core Architectural Mandates:
1. **Serverless Scalability:** 100% serverless compute and database infrastructure (Cloud Run, Cloud Firestore Native, BigQuery, Cloud Storage) scaling automatically from 0 to peak concurrency with zero idle VM overhead.
2. **Multi-Project Isolation:** Every document, task, sprint, risk metric, and audit log is partitioned and indexed by `project_id`.
3. **Multi-Modal AI Pipeline:** Combines Google Document AI (optical layout parsing) and Google Vertex AI (`gemini-2.5-flash`) for requirement understanding, ambiguity resolution, backlog decomposition, and grounded citation retrieval.
4. **Dual Operational Modes:**
   - **Standalone Mode (Native GCP):** Native Firestore Agile backlog + direct GitHub commit and PR tracking + Google NotebookLM living knowledge hub.
   - **Enterprise Sync Mode:** Bidirectional synchronization with Atlassian Jira (REST v3) and Confluence (REST v2) with GitHub and NotebookLM.
5. **Auditable 3-Tier Governance:** Every AI action is classified into `Auto-execute`, `Approval Required`, or `Human-Only`, emitting an append-only immutable audit trail to Firestore and BigQuery.

---

## 2. GCP Infrastructure & Resource Inventory

The following Google Cloud Platform resources are provisioned and actively serving production workloads:

| GCP Service | Resource Name / Identifier | Region | Configuration & Purpose |
|---|---|---|---|
| **Cloud Run (Web Cockpit)** | `ai-scrum-cockpit` | `us-central1` | Next.js 15+ App Router standalone container (Node.js 20 Alpine, gentle slate theme, auto-scaling 0–10 instances). |
| **Cloud Run (Core API)** | `ai-scrum-api` | `us-central1` | FastAPI Python 3.11 asynchronous backend server (Uvicorn, REST v1 routers, OpenAPI Swagger docs). |
| **Artifact Registry** | `app-images` | `us-central1` | Docker container registry hosting production container images (`api:latest`, `web:latest`). |
| **Cloud Storage (GCS)** | `gs://ai-scrum-master-510116-prd-uploads` | `us-central1` | Object storage bucket storing raw uploaded PRD specification documents (`.pdf`, `.md`, `.txt`, `.docx`), partitioned by `{project_id}/{file_name}`. |
| **Cloud Firestore** | `(default)` (Native Mode) | `us-central1` | Real-time NoSQL document database hosting multi-tenant collections (`projects`, `requirements`, `open_questions`, `epics`, `stories`, `tasks`, `sprints`, `meetings`, `governance_approvals`, `activity_logs`, `knowledge_items`). |
| **BigQuery** | `scrum_delivery_analytics` | `us-central1` | Enterprise analytical warehouse hosting partitioned tables (`sprint_snapshots`, `task_cycle_times`, `git_commit_telemetry`) for predictive cycle time and spillover trend analysis. |
| **Vertex AI** | `gemini-2.5-flash` | `us-central1` | High-efficiency foundation LLM invoked for document understanding, ambiguity detection, backlog decomposition, and grounded search. |
| **Document AI** | Document AI API | `us-central1` | Optical Character Recognition (OCR), document structure, and heading extraction service. |
| **Cloud Build** | Automated CI/CD Pipeline | Global / `us-central1` | Automated containerization, testing (`pytest`), image push, and Cloud Run deployment pipeline (`cloudbuild.yaml`). |

---

## 3. High-Level GCP Connectivity & Service Interaction Diagram

```mermaid
graph TD
    Client([User Browser]) -->|HTTPS :443| WebRun[Cloud Run: ai-scrum-cockpit<br/>Next.js 15 SSR & React 19]
    Client -.->|Direct API calls / CORS| APIRun[Cloud Run: ai-scrum-api<br/>FastAPI Microservice Engine]
    WebRun -->|Internal Fetch / SSR| APIRun

    subgraph GCP Compute & AI Services (us-central1)
        APIRun -->|Generate Content| VertexAI[Vertex AI Gemini 2.5 Flash]
        APIRun -->|Document OCR & Tables| DocAI[Document AI OCR]
        APIRun -->|Store Binary/Text Files| GCS[Cloud Storage Bucket<br/>gs://ai-scrum-master-510116-prd-uploads]
    end

    subgraph GCP Storage & Analytics Persistence
        APIRun -->|CRUD & Real-time State| Firestore[(Cloud Firestore Native DB<br/>projects, tasks, sprints, etc.)]
        APIRun -->|Append Delivery Telemetry| BigQuery[(Google BigQuery<br/>scrum_delivery_analytics)]
        APIRun -->|Grounded Source Registration| NotebookLM[Google NotebookLM<br/>Workspace Living Knowledge]
    end

    subgraph External System Connectors
        APIRun -->|PR & Commit Webhooks/Polling| GitHub[GitHub REST API]
        APIRun -->|Bidirectional Sync (Optional)| Atlassian[Jira REST v3 & Confluence v2]
    end
```

---

## 4. End-to-End Data Flow Pipelines

### Pipeline 1: Project Provisioning & Multi-Tenant Isolation
1. **Request:** Client submits `POST /v1/projects` with name, key, operating mode (`STANDALONE` vs `ENTERPRISE_SYNC`), velocity target, and team members.
2. **Execution:**
   - Backend assigns a deterministic or UUID-based `project_id` (e.g. `proj-9d42c106`).
   - Persists project document to Cloud Firestore: `projects/{project_id}`.
   - Initializes Firestore sub-collection structures.
3. **Isolation Rule:** All subsequent requests require `project_id`. Firestore composite indexes filter queries using:
   ```json
   { "fieldPath": "project_id", "order": "ASCENDING" }
   ```

---

### Pipeline 2: Document Ingestion, Cloud Storage & AI Semantic Extraction
1. **Upload Trigger:** In **Document Studio**, the user uploads a `.pdf`, `.docx`, `.txt`, or `.md` file, or pastes text.
2. **GCS Persistence (`storage_client.py`):**
   - The file payload is streamed to Cloud Storage via Google Cloud Storage JSON API:
     `gs://ai-scrum-master-510116-prd-uploads/{project_id}/{safe_filename}`.
   - The permanent `gcs_uri` is generated and attached to the requirement record.
3. **Text Extraction:**
   - For PDF documents: Native multi-page parser (`pypdf`) extracts all text streams, headings, and character blocks across all pages.
   - For Document AI processors: Binary bytes are dispatched to Google Document AI for OCR and layout parsing.
4. **Vertex AI Semantic Understanding:**
   - Constructs an AI prompt passing the extracted text.
   - Invokes **Vertex AI Gemini 2.5 Flash** in `us-central1`.
   - Gemini outputs structured JSON containing:
     - `business_goal`: High-level business objective.
     - `capabilities`: Extracted system capabilities (`CAP-01`, `CAP-02`, etc.) with section references.
     - `personas`: Target user profiles, roles, and pain points.
     - `clauses`: Individual requirements tagged as `FUNCTIONAL`, `AMBIGUITY`, or `ASSUMPTION`.
5. **NotebookLM Living Knowledge Sync:**
   - Registers the document title, summary, and `gcs_uri` into `knowledge_items` with a unique `notebooklm_source_id`.
6. **Firestore Persistence:** Writes the extracted specification to `requirements/req-{project_id}`.

---

### Pipeline 3: Ambiguity Flagging & Human-in-the-Loop Clarification
1. **Analysis Trigger (`ambiguity_agent.py`):**
   - Reads the requirement clauses from `requirements/req-{project_id}`.
   - Prompts Gemini 2.5 Flash to identify underspecified criteria (e.g. missing storage limits, retry ceilings, timeout parameters).
2. **Open Questions Registry:**
   - Gemini generates 2–3 targeted questions with `priority`, `delivery_impact`, and `ai_suggested_answer`.
   - Persists each question to Cloud Firestore: `open_questions/{question_id}`.
3. **Resolution:**
   - Product Owner reviews suggestions in Document Studio and clicks **"Accept Suggestion"** or inputs a custom answer.
   - `POST /v1/backlog/questions/resolve` sets `resolved: true` and writes `resolved_answer` to Firestore.

---

### Pipeline 4: Traceable Backlog Decomposition (4-Tier Hierarchy)
1. **Decomposition Trigger (`backlog_agent.py`):**
   - Invoked via `POST /v1/backlog/generate`.
   - Reads the specification baseline, capabilities (`CAP-xx`), clauses (`CLS-xx`), assigned team members, and all resolved Product Owner answers from Firestore.
2. **Gemini 2.5 Flash Reasoning:**
   - Prompt instructs Gemini to synthesize Epics, Stories, and Subtasks **strictly matching the vocabulary and domain of the ingested specification**.
   - Outputs:
     - **Epic:** Overall initiative narrative with origin linking to the PRD file name.
     - **User Stories:** `As a [role], I want [action] so that [benefit]` with story point estimates.
     - **Gherkin Acceptance Criteria:** Executable `Given / When / Then` scenarios.
     - **Dev & QA Subtasks:** Concrete development tasks and automated verification test suites.
3. **Traceability Guarantee (`native_provider.py`):**
   - **Epic:** Stores `requirement_origin` pointing to the ingested PRD document title.
   - **User Story:** Stores `requirement_origin` pointing to the exact section/capability (e.g. `PRD §2.0: Zone Power Modulation`).
   - **Subtask:** Stores `trace_ref` pointing to its Acceptance Criterion (`AC-1`).
   - Committed to Cloud Firestore in collections `epics/`, `stories/`, and `tasks/`.

---

### Pipeline 5: Meeting Intelligence & Autonomous State Synchronization
1. **Transcript Submission (`POST /v1/meetings/extract`):**
   - Product Owner or engineer pastes notes from Daily Scrum, Sprint Review, or Retrospectives.
2. **Gemini Meeting Reasoning (`meeting_agent.py`):**
   - Fetches active tasks for `project_id` from Firestore.
   - Gemini parses the transcript and extracts:
     - `summary`: Concise executive synthesis.
     - `decisions`: Logged agreements, deciders, and governance tiers.
     - `blockers`: Blocked engineers, impediment details, and impact.
     - `actions`: Follow-up actions and status updates.
3. **Autonomous Firestore Mutations:**
   - If a blocker is mentioned for any task in Firestore, the agent automatically updates that task:
     ```json
     { "status": "BLOCKED", "is_blocked": true, "blocker_reason": "..." }
     ```
   - If a task is completed, it transitions to `status: "DONE"`.
   - Saves meeting record to `meetings/{meeting_id}`.

---

### Pipeline 6: GitHub Telemetry & Real-Time Flash Health Engine
1. **Telemetry Collection (`flash_engine.py`):**
   - Periodically or on-demand inspects active feature branch commits and Pull Requests linked to the project's issue keys.
2. **Heuristic Evaluation:**
   - **🟢 ON-TRACK:** Active commit activity recorded within the last 48 hours; all PRs passing CI checks; zero blocked tasks.
   - **🟡 AT-RISK:** In-progress tasks showing zero commits for >24 hours or approaching sprint boundary.
   - **🔴 OFF-TRACK:** Any task explicitly marked `BLOCKED` in Firestore; PR checks failing CI; or stalled tasks with >48 hours of inactivity.
3. **Frontend Broadcast:**
   - Displayed in the top navigation bar and executive dashboard as an immediate visual indicator (🟢/🟡/🔴).

---

### Pipeline 7: Risk Radar & Directed Acyclic Graph (DAG) Traversal
1. **Graph Construction (`risk_agent.py`):**
   - Queries all task documents for `project_id` from Cloud Firestore.
   - Constructs an in-memory Directed Acyclic Graph using `networkx`.
   - Identifies the **Critical Path** and calculates **Critical Path Aging** (hours since last verified activity).
2. **Spillover Forecast (`sprint_agent.py`):**
   - Evaluates whether an in-progress or blocked task has a high probability of spilling into the next sprint (>70%).
   - Recommends whether to roll the item forward or split scope in the **Spillover Triage Workbench**.

---

### Pipeline 8: BigQuery Analytics & Executive Leadership Reports
1. **Data Warehouse Streaming (`bigquery_client.py`):**
   - Every completed sprint snapshot, task status transition, and Git commit telemetry event is inserted into BigQuery dataset `scrum_delivery_analytics`.
   - Uses daily partitioned tables (`PARTITION BY DATE(timestamp)`).
2. **Analytical Queries:**
   - Computes Lead Time, Cycle Time trends, and multi-sprint historical velocity burndown.
3. **Executive Report Generation (`reports.py`):**
   - Combines live Firestore task states with BigQuery cycle-time metrics.
   - Gemini 2.5 Flash formulates a leadership briefing containing **Key Accomplishments**, **Critical Path Bottlenecks**, and **Retrospective Commitments**.
   - Available as a one-click Markdown export in the **Actionable Reports** tab.

---

## 5. Security, IAM & Governance Architecture

### Least-Privilege IAM Bindings on GCP:

The compute service account (`638799400872-compute@developer.gserviceaccount.com`) is assigned strictly the permissions needed for autonomous operation:

```bash
# Cloud Run Execution & Deployment
roles/run.admin
roles/iam.serviceAccountUser

# AI Foundation Models & Layout Parsing
roles/aiplatform.user
roles/documentai.apiUser

# Cloud Storage Object Persistence
roles/storage.admin

# Artifact Registry Container Pull/Push
roles/artifactregistry.writer

# Cloud Logging & Audit Trail
roles/logging.logWriter
```

### Firestore Security Policies (`firestore.rules`):
- Multi-tenant data segregation enforced by `project_id`.
- The `activity_logs` collection is **append-only and immutable**; updates and deletions are rejected by rule:
  ```javascript
  match /activity_logs/{logId} {
    allow read: if true;
    allow create: if request.resource.data.timestamp != null;
    allow update, delete: if false; // Immutable audit log
  }
  ```

---

## 6. Summary: Local Development vs. Production Parity

| Component | Local Development (`localhost`) | Production Google Cloud (`Cloud Run`) |
|---|---|---|
| **Frontend Cockpit** | `http://localhost:3000` (Next.js Dev Server) | `https://ai-scrum-cockpit-a355sfc3uq-uc.a.run.app` |
| **Backend Core API** | `http://localhost:8000` (Uvicorn ASGI) | `https://ai-scrum-api-a355sfc3uq-uc.a.run.app` |
| **API Resolution** | `getApiBase()` routes to `localhost:8000/v1` | `getApiBase()` auto-detects `run.app` -> routes to Cloud Run API |
| **Cloud Storage** | Writes to live bucket via ADC / `gcloud auth` | Writes to live bucket via Compute SA metadata tokens |
| **Firestore Database** | Connects to live Firestore native `(default)` | Connects to live Firestore native `(default)` |
| **Vertex AI (Gemini)** | Live Gemini 2.5 Flash via REST token | Live Gemini 2.5 Flash via REST SA token |
| **BigQuery Warehouse** | Queries live BigQuery `scrum_delivery_analytics` | Queries live BigQuery `scrum_delivery_analytics` |

---
*Document Version: 1.0 · Last Updated: October 2026 · Maintained in `docs/GCP_Architecture_and_Data_Flow_Design_Document.md`*
