# AI Scrum Master: Complete End-to-End Architecture Blueprint

This document specifies the complete end-to-end (E2E) system architecture for the **AI Scrum Master** platform. It consolidates the functional requirements, the dual-mode operational pattern (Standalone Native vs. Enterprise Atlassian Sync), the Google NotebookLM Knowledge Center, GitHub Flash Health tracking, and the Google Cloud Platform multi-agent serverless deployment topology.

## 1. Global End-to-End System Topology (High-Level)

```
========================================================================================================================
                                                  CLIENT & INGESTION LAYER
========================================================================================================================
   [ Product Owners / Leads ]      [ Developers / QA ]       [ Meeting Audio / Notes ]     [ Webhooks / Git Commits ]
               │                            │                            │                            │
               └────────────────────────────┼────────────────────────────┴────────────────────────────┘
                                            │ HTTPS / WSS (TLS 1.3)
                                            ▼
                                ┌───────────────────────┐
                                │      Cloud Armor      │  <-- WAF, OWASP Top 10, L3/L4/L7 DDoS, Rate Limiting
                                └───────────┬───────────┘
                                            │
                                            ▼
                                ┌───────────────────────┐
                                │ Cloud Load Balancing  │  <-- Global Anycast VIP, SSL Termination, CDN Caching
                                └───────────┬───────────┘
                                            │
                      ┌─────────────────────┴─────────────────────┐
                      │ Path-Based Routing (/api/* vs /*)         │
                      ▼                                           ▼
========================================================================================================================
                                            APPLICATION COMPUTE LAYER (Cloud Run)
========================================================================================================================
       ┌───────────────────────────────┐                 ┌─────────────────────────────────────────┐
       │   Cloud Run: Frontend Web     │                 │        Cloud Run: Core Engine API       │
       │   - Next.js 15+ / React 19    │                 │   - FastAPI 0.109+ (Python 3.11)        │
       │   - Radix UI & Tailwind CSS   │──── REST / WSS ─▶│   - Provider Factory (Mode Router)      │
       │   - Interactive DAG & Kanban  │                 │   - Session Security & Token Auth       │
       │   - Copilot Drawer (⌘J)       │                 │   - Flash Health Engine (🟢🟡🔴)         │
       └───────────────────────────────┘                 └────────────────────┬────────────────────┘
                                                                              │
                                                ┌─────────────────────────────┴─────────────────────────────┐
                                                ▼                                                           ▼
========================================================================================================================
                                     DUAL-OPERATIONAL PROVIDER INTEGRATION LAYER
========================================================================================================================
             ┌─────────────────────────────────────────┐                 ┌─────────────────────────────────────────┐
             │       MODE A: STANDALONE (NATIVE)       │                 │      MODE B: ENTERPRISE INTEGRATED      │
             │   (Zero External Atlassian Overhead)    │                 │    (Jira + Confluence + GitHub Sync)    │
             ├─────────────────────────────────────────┤                 ├─────────────────────────────────────────┤
             │ • Native Backlog Provider (Firestore)   │                 │ • JiraBacklogProvider (REST API v3)     │
             │ • Native Document Studio (GCS/Store)    │                 │ • ConfluenceDocProvider (REST API v2)   │
             │ • Native Sprint Kanban & Capacity Engine│                 │ • Enterprise Issue Key Sync (CLM, FIN)  │
             │ • Direct GitHub Commit Tracker          │                 │ • Dedicated Confluence Space Sync       │
             │   (Parses TSK-* / STY-* for Cadence)    │                 │ • Enterprise GitHub Commit Tracker      │
             └────────────────────┬────────────────────┘                 └────────────────────┬────────────────────┘
                                  │                                                           │
                                  └─────────────────────────────┬─────────────────────────────┘
                                                                │
========================================================================================================================
                                KNOWLEDGE, RETRIEVAL & NOTEBOOKLM WORKSPACE LAYER
========================================================================================================================
                                                                ▼
                     ┌────────────────────────────────────────────────────────────────────────┐
                     │          Google NotebookLM Project Knowledge Center Integration         │
                     │          - Workspace URL: notebooklm.google.com/notebook/{id}          │
                     │          - Grounded Citations, Exact Snippets & Source Attribution      │
                     │          - Audio Overview Briefings & Executive Summaries              │
                     └───────────────────┬────────────────────────────────┬───────────────────┘
                                         │                                │
                                         ▼                                ▼
                     ┌──────────────────────────────────────┐ ┌──────────────────────────────────────┐
                     │           Vertex AI Search           │ │       Document AI (Layout Parser)    │
                     │ - Grounded Semantic RAG Store        │ │ - Hierarchical OCR (PDF/DOCX/Images) │
                     │ - Retros, ADRs, PRD Version Index    │ │ - Tables, Headings, Clause Extractor │
                     └───────────────────┬──────────────────┘ └───────────────────┬──────────────────┘
                                         │                                        │
========================================================================================================================
                              MULTI-AGENT ORCHESTRATION LAYER (Vertex AI & ADK)
========================================================================================================================
                                         │                                        │
                                         └───────────────────┬────────────────────┘
                                                             │
                                                             ▼
                                     ┌────────────────────────────────────────────────┐
                                     │     ADK Master Orchestrator Agent Core         │
                                     │     - Event Consumer & Project State Manager   │
                                     │     - 3-Tier Governance & Guardrails Engine    │
                                     └───────────────────────┬────────────────────────┘
                                                             │
        ┌───────────────────┬───────────────────┬────────────┴───────┬───────────────────┬───────────────────┐
        ▼                   ▼                   ▼                    ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐    ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Understanding │   │   Ambiguity   │   │    Backlog    │    │Sprint Planning│   │    Meeting    │   │  Risk & DAG   │
│     Agent     │   │ Agent (FR-03) │   │ Agent (FR-04) │    │ Agent (FR-07) │   │ Agent (FR-08) │   │ Agent (FR-14) │
│ - Personas    │   │ - Edge Gaps   │   │ - Epic->Story │    │ - Capacity    │   │ - Diarized STT│   │ - NetworkX    │
│ - Scope Bounds│   │ - PO Questions│   │ - Gherkin ACs │    │ - 10% Buffer  │   │ - Decisions   │   │ - 5D Health   │
│ - Rules & NFRs│   │ - Auto-Defaults│  │ - QA Test Defs│    │ - Sprint Goals│   │ - Blocker sync│   │ - Critical DAG│
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘    └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                   │                   │                    │                   │                   │
        └───────────────────┴───────────────────┼────────────────────┴───────────────────┴───────────────────┘
                                                │ Pydantic v2 Validated Domain Models
                                                ▼
========================================================================================================================
                                  EVENT DISPATCHING, STATE & ANALYTICAL STORAGE LAYER
========================================================================================================================
                                                │
                                                ▼
                               ┌─────────────────────────────────┐
                               │    Cloud Pub/Sub & Eventarc     │
                               └────────────────┬────────────────┘
                                                │
                     ┌──────────────────────────┴──────────────────────────┐
                     │                                                     │
                     ▼                                                     ▼
┌─────────────────────────────────────────┐             ┌─────────────────────────────────────────┐
│         Cloud Firestore (Native)        │             │           BigQuery Analytics            │
│ - Operational Transactional Backlog     │             │ - Columnar Delivery Analytics Dataset   │
│ - Epics, Stories, Tasks, QA Test Suites │             │ - Historical Sprint Closing Snapshots   │
│ - 3-Tier Approval Ledger & Governance   │             │ - Velocity, Lead Time & Cycle Trends    │
│ - Immutable Activity Audit Log Trail    │             │ - Predictive Spillover Regression Engine│
└─────────────────────────────────────────┘             └─────────────────────────────────────────┘
========================================================================================================================

```

## 2. End-to-End Operational Sequence & Data Flow

The sequence below illustrates the full lifecycle: from PRD ingestion to multi-agent backlog creation, sprint planning, live meeting entity processing, GitHub code commit tracking, and BigQuery analytics.

```
sequenceDiagram
    autonumber
    actor PO as Product Owner / Team
    participant UI as Web Cockpit (Next.js)
    participant API as FastAPI Backend (Cloud Run)
    participant DocAI as Document AI Layout Parser
    participant ADK as Vertex AI ADK Orchestrator
    participant Gemini as Gemini 3 (Agents)
    participant NLM as Google NotebookLM / Search
    participant Git as GitHub / Git Tracker
    participant FS as Cloud Firestore
    participant BQ as BigQuery Analytics

    %% PHASE 1: INGESTION & DECOMPOSITION
    Note over PO, Gemini: PHASE 1: Requirement Document Ingestion & Understanding
    PO->>UI: Upload PRD (.pdf / .docx)
    UI->>API: POST /v1/ingest (Multi-part upload)
    API->>DocAI: Send Document for Layout & Structural OCR
    DocAI-->>API: Return Structured JSON (Tokens, Tables, Headings)
    API->>NLM: Sync PRD to NotebookLM Project Workspace & Vertex AI Search
    API->>ADK: Dispatch EVENT_DOCUMENT_UPLOADED
    ADK->>Gemini: Trigger Understanding Agent (Personas, Goals, Scope)
    ADK->>Gemini: Trigger Ambiguity Agent (Detect Missing ACs, Edge Gaps)
    Gemini-->>FS: Persist Open Questions Card (FR-03)
    FS-->>UI: Live Stream Open Questions to Action Center

    %% PHASE 2: HUMAN APPROVAL & BACKLOG
    Note over PO, FS: PHASE 2: PO Approval & Backlog Decomposition
    PO->>UI: Answer / Approve Open Questions
    UI->>API: POST /v1/governance/approve
    API->>ADK: Trigger Backlog Agent
    ADK->>Gemini: Decompose into Epic -> Feature -> Story -> Dev/QA Tasks
    Gemini-->>FS: Save 4-tier Backlog with Gherkin Acceptance Criteria
    FS-->>UI: Real-Time Render on Interactive Canvas / Kanban

    %% PHASE 3: SPRINT PLANNING & HEALTH
    Note over PO, Git: PHASE 3: Capacity Planning & Live Execution Tracking
    PO->>UI: Request Sprint Recommendation
    UI->>API: POST /v1/sprints/plan
    API->>ADK: Trigger Sprint Agent (Fetch Capacity, Velocity, Apply 10% Buffer)
    Gemini-->>UI: Recommend Sprint Scope, Target Goal & Spillover Guard
    PO->>UI: Commit Active Sprint (Tier 2 Human Gate)
    
    %% PHASE 4: EXECUTION & COMMIT TELEMETRY
    Note over Git, UI: PHASE 4: Meeting Sync & GitHub Flash Health Tracking
    PO->>UI: Submit Daily Standup Notes / Audio
    UI->>API: POST /v1/meetings/standup
    API->>Gemini: Meeting Agent Diarizes & Extracts Blockers, Tasks, Decisions
    Gemini-->>FS: Update Task States (IN_PROGRESS -> IN_REVIEW)
    Git->>API: Webhook: Developer Commit / PR (Tagged TSK-101 / CLM-101)
    API->>API: Flash Health Engine Evaluates Cadence & Staleness
    API-->>UI: Push Flash Health Badge (🟢 ON-TRACK / 🟡 AT-RISK / 🔴 OFF-TRACK)

    %% PHASE 5: RISK DAG & RETRO ANALYTICS
    Note over ADK, BQ: PHASE 5: Topological Risk DAG & BigQuery Sprint Closing
    ADK->>Gemini: Trigger Risk Agent (NetworkX DAG Topological Sort)
    Gemini-->>UI: 5D Health Radar (Scope Volatility, Blocker Density, Critical Path)
    PO->>UI: Complete Sprint
    UI->>API: POST /v1/sprints/close
    API->>BQ: Stream Sprint Snapshot (Velocity, Cycle Times, Spillovers)
    BQ-->>UI: Render Historical Predictive Trend Charts & Kaizen Insights

```

## 3. Multi-Agent System Architecture (Vertex AI ADK Engine)

The multi-agent core is decoupled from the transactional backend. Agents interact via typed Pydantic domain models, hydrate context from Firestore, and ground their domain knowledge via Vertex AI Search and Google NotebookLM.

```
                              ┌────────────────────────────────────────────────────────┐
                              │                 ADK Orchestrator Agent                 │
                              │           (Event Consumer & Workflow Router)           │
                              └───────────────────────────┬────────────────────────────┘
                                                          │
             ┌────────────────────────────────────────────┼────────────────────────────────────────────┐
             │                                            │                                            │
             ▼                                            ▼                                            ▼
┌───────────────────────────┐                ┌───────────────────────────┐                ┌───────────────────────────┐
│   Understanding Agent     │                │   Meeting Agent (FR-08)   │                │     Risk Agent (FR-14)    │
├───────────────────────────┤                ├───────────────────────────┤                ├───────────────────────────┤
│ • Consumes Doc AI Layout  │                │ • Consumes Audio & Notes  │                │ • NetworkX Graph Engine   │
│ • Extracts Personas/Goals │                │ • Speech-to-Text v2 Tags  │                │ • Critical Path Analyzer  │
│ • Boundaries & NFR Rules  │                │ • Blocker & Decision Extr.│                │ • Stagnation Watch (>48h) │
└─────────────┬─────────────┘                └─────────────┬─────────────┘                └─────────────┬─────────────┘
              │                                            │                                            │
              ▼                                            ▼                                            ▼
┌───────────────────────────┐                ┌───────────────────────────┐                ┌───────────────────────────┐
│  Ambiguity Agent (FR-03)  │                │    Task Agent (FR-06)     │                │  Knowledge Agent (FR-18)  │
├───────────────────────────┤                ├───────────────────────────┤                ├───────────────────────────┤
│ • Open Questions Engine   │                │ • Status State Transitions│                │ • NotebookLM Integration  │
│ • Detects Missing Specs   │                │ • Reassignment Suggestions│                │ • Vertex AI Search RAG    │
│ • Impact & Suggested Answ.│                │ • QA Test Task Linkage    │                │ • Decision/ADR Retrieval  │
└─────────────┬─────────────┘                └─────────────┬─────────────┘                └─────────────┬─────────────┘
              │                                            │                                            │
              ▼                                            ▼                                            │
┌───────────────────────────┐                ┌───────────────────────────┐                              │
│   Backlog Agent (FR-04)   │                │   Sprint Agent (FR-07)    │                              │
├───────────────────────────┤                ├───────────────────────────┤                              │
│ • 4-Tier Decomposition    │                │ • Developer Capacity Calc │                              │
│ • Epic -> Feature -> Story│                │ • 10% Risk Buffer Guard   │                              │
│ • Executable Gherkin ACs  │                │ • Sprint Goal Synthesis   │                              │
└─────────────┬─────────────┘                └─────────────┬─────────────┘                              │
              │                                            │                                            │
              └─────────────────────────────┬──────────────┴────────────────────────────────────────────┘
                                            │
                                            ▼
                              ┌────────────────────────────────────────┐
                              │        Shared Pydantic Domain State    │
                              │   - Task, Risk, Blocker, Decision      │
                              │   - SprintGoal, OpenQuestion, Trace    │
                              └────────────────────────────────────────┘

```

### Agent Responsibility & Capability Matrix

| 

| **Agent Name** | **Primary Trigger** | **Key Inputs** | **Primary Output / Actions** | 
| **ADK Orchestrator** | Eventarc / REST | System Events, Firestore context | Directs execution pipelines, validates schemas, enforces 3-tier governance. | 
| **Understanding Agent** | PRD Upload | Document AI Layout JSON, OCR text | Business objectives, persona definitions, operational capabilities, NFRs. | 
| **Ambiguity Agent** | Understanding Output | Parsed clauses, standard specs | Open Questions Cards with impact ratings, priorities, and PO recommended defaults. | 
| **Backlog Agent** | PO Approval | Verified requirement clauses | 4-tier hierarchy (`Epic -> Feature -> Story -> Dev/QA Tasks`) with Gherkin ACs. | 
| **Sprint Agent** | Planning Event | Backlog items, team skill/capacity | Sprint goal, recommended committed scope, 10% risk buffer, spillover actions. | 
| **Meeting Agent** | Audio / Text Ingest | Standup/Review transcripts | Diarized decisions, action items, task state transitions, and impediment records. | 
| **Risk Agent** | State Changes | Task dependencies, Git activity | NetworkX topological DAG, critical path slips, stagnation (>48h), 5D Health Matrix. | 
| **Knowledge Agent** | User Prompt (⌘J) | Vertex AI Search, NotebookLM | Grounded answers with exact citations, source snippets, and audio briefings. | 

## 4. Pluggable Dual-Mode Architecture & Git Tracking

The system provides complete operational independence for teams without Atlassian tooling, while offering seamless bidirectional synchronization for enterprise environments.

```
                                    ┌───────────────────────────────────┐
                                    │    Project Configuration State    │
                                    │ - Mode: STANDALONE | ENTERPRISE   │
                                    │ - NotebookLM Workspace ID & URL   │
                                    │ - GitHub Repository (owner/repo)  │
                                    └─────────────────┬─────────────────┘
                                                      │
                                                      ▼
                                    ┌───────────────────────────────────┐
                                    │      Backend ProviderFactory      │
                                    └─────────┬───────────────┬─────────┘
                                              │               │
                     ┌────────────────────────┘               └────────────────────────┐
                     ▼                                                                 ▼
      ┌───────────────────────────────┐                                 ┌───────────────────────────────┐
      │  MODE A: STANDALONE (NATIVE)  │                                 │ MODE B: ENTERPRISE INTEGRATED │
      ├───────────────────────────────┤                                 ├───────────────────────────────┤
      │ • NativeFirestoreBacklog      │                                 │ • JiraBacklogProvider         │
      │   - Epics, Stories, Tasks     │                                 │   - Jira Cloud REST v3        │
      │ • NativeFirestoreDocProvider  │                                 │   - JQL Query & Issue Mapping │
      │   - Specs, ADRs, Retros       │                                 │ • ConfluenceDocProvider       │
      │ • Native Kanban Board         │                                 │   - Confluence Cloud REST v2  │
      │ • Zero 3rd-Party Licensing    │                                 │   - Space & Page Sync         │
      └──────────────┬────────────────┘                                 └───────────────┬───────────────┘
                     │                                                                  │
                     └────────────────────────┬─────────────────────────────────────────┘
                                              │
                                              ▼
                             ┌──────────────────────────────────┐
                             │       GitHubTrackerProvider      │
                             │     (Active in Both Modes)       │
                             ├──────────────────────────────────┤
                             │ • Webhook / Commit Poller        │
                             │ • Matches Native Keys: TSK-*     │
                             │ • Matches Jira Keys:   CLM-*     │
                             │ • Evaluates PR Review Status     │
                             └────────────────┬─────────────────┘
                                              │
                                              ▼
                             ┌──────────────────────────────────┐
                             │    Flash Health Engine (🟢🟡🔴)    │
                             ├──────────────────────────────────┤
                             │ 🟢 ON-TRACK: Active commits <24h │
                             │ 🟡 AT-RISK:  No commits 24-48h   │
                             │ 🔴 OFF-TRACK: Stagnant >48h or   │
                             │    unmerged PR blocking critical │
                             └──────────────────────────────────┘

```

## 5. Google NotebookLM Project Knowledge Center Architecture

Each project workspace is tied to a dedicated Google NotebookLM instance, acting as an enterprise grounded memory store with audio briefings and source citations:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PROJECT NOTEBOOKLM KNOWLEDGE CENTER                             │
│                  URL: https://notebooklm.google.com/notebook/{notebook_id}             │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
           ┌────────────────────────────────┼────────────────────────────────┐
           │                                │                                │
           ▼                                ▼                                ▼
┌───────────────────────┐        ┌───────────────────────┐        ┌───────────────────────┐
│ Grounded Sources Ingest│        │  Grounded Q&A Search  │        │ Audio Overview Engine │
├───────────────────────┤        ├───────────────────────┤        ├───────────────────────┤
│ • Approved PRD Specs  │        │ • Natural Language Q&A│        │ • Executive Podcasts  │
│ • Meeting Transcripts │        │ • Exact Page & Clause │        │ • 5-Minute Sprint     │
│ • Architecture ADRs   │        │   Citations           │            Briefing Audio      │
│ • Retrospective Logs  │        │ • High-Confidence RAG │        │ • Key Takeaway Kaizens│
└───────────────────────┘        └───────────────────────┘        └───────────────────────┘
           │                                │                                │
           └────────────────────────────────┼────────────────────────────────┘
                                            ▼
                     ┌──────────────────────────────────────────────┐
                     │          Vertex AI Search Connector          │
                     │  - Replicates NotebookLM source index in GCP │
                     │  - Low-latency retrieval for ADK agents      │
                     └──────────────────────────────────────────────┘

```

## 6. Closed-Loop Operational Lifecycle (Observe → Act → Learn)

The AI Scrum Master operates on a closed-loop execution pattern where insights drive recommendations, gated approvals execute actions, and retrospective metrics feed future sprints:

```
                          ┌───────────────────────────┐
                          │         1. OBSERVE        │
                          │ PRD Uploads, Meeting STT, │
                          │ Git Commits, Task Aging   │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │       2. UNDERSTAND       │
                          │ Layout Parsing, Semantic  │
                          │ Goals, Blocker Extraction │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │          3. PLAN          │
                          │ Backlog Sizing, Capacity  │
                          │ Buffer, Critical Path DAG │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │         4. EXECUTE        │
                          │ Task Assignment, Kanban   │
                          │ State Shifts, Git Tracking│
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │         5. MONITOR        │
                          │ Flash Health, 5D Radar,   │
                          │ Idle Checks (>48h Alert)  │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │      6. RECOMMEND/ACT     │
                          │ 3-Tier Governance Gate:   │
                          │ Auto / Approval / Human   │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │      7. LEARN & ADAPT     │
                          │ BigQuery Retros, Velocity │
                          │ Calibration, Buffers      │
                          └─────────────┬─────────────┘
                                        │
                                        └───────▶ Loops to Next Sprint Planning

```

## 7. 3-Tier Governance & Human-in-the-Loop Safeguards

To prevent hallucinations from disrupting active sprint execution, all agent operations pass through the **Governance Guardrail Engine**:

```
                                [ Incoming Agent Action ]
                                            │
                                            ▼
                         /──────────────────────────────────────\
                        <  What is the Action's Governance Tier? >
                         \──────────────────────────────────────/
                                    │         │         │
               ┌────────────────────┘         │         └────────────────────┐
               ▼                              ▼                              ▼
      ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
      │     TIER 1      │            │     TIER 2      │            │     TIER 3      │
      │   AUTO-EXECUTE  │            │APPROVAL REQUIRED│            │   HUMAN-ONLY    │
      └────────┬────────┘            └────────┬────────┘            └────────┬────────┘
               │                              │                              │
               ▼                              ▼                              ▼
      ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
      │ • Standup Notes │            │ • Modify Sprint │            │ • Product Vision│
      │ • Gherkin Format│            │   Commitment    │            │ • Final Scope   │
      │ • Skill Tagging │            │ • Split Story   │            │   Sign-off      │
      │ • Draft Answers │            │ • Assign Owner  │            │ • Delete Epic   │
      │ • Risk Radar    │            │ • Shift Deadline│            │ • Team Capacity │
      └────────┬────────┘            └────────┬────────┘            └────────┬────────┘
               │                              │                              │
               ▼                              ▼                              ▼
     [ Execute Silently ]          [ Push to PO Action ]          [ Recommend Only ]
     [ Log to Audit     ]          [ Center for 1-Click]          [ Require Manual ]
                                   [ Approve or Reject ]          [ Execution in UI]

```

## 8. Data Architecture & Storage Stratification

The storage layer enforces strict separation between high-speed transactional state and long-term analytical computing.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DATA PERSISTENCE & STORAGE ARCHITECTURE                         │
└────────────────────────────────────────────────────────────────────────────────────────┘

 ┌────────────────────────────────────────┐    ┌────────────────────────────────────────┐
 │        FIRESTORE (Native Mode)         │    │           BIGQUERY ANALYTICS           │
 │       (Transactional State & UI)       │    │     (Historical Trends & Modeling)     │
 ├────────────────────────────────────────┤    ├────────────────────────────────────────┤
 │ /projects/{projectId}                  │    │ Dataset: scrum_delivery_analytics      │
 │   ├── /requirements/                   │    │                                        │
 │   ├── /epics/                          │    │ Table: sprint_snapshots                │
 │   ├── /stories/                        │    │ - project_id, sprint_id                │
 │   │     └── /tasks/ (Dev + QA)         │    │ - planned_points, delivered_points     │
 │   ├── /sprints/ (Active & Planned)     │    │ - spillover_points, cycle_time_avg     │
 │   ├── /meetings/ (Standup, Retro, Plan)│    │ - Partitioned by: sprint_end_date (DAY)│
 │   ├── /risks/ (Active & Aging)         │    │                                        │
 │   ├── /dependencies/ (DAG Edges)       │    │ Table: task_cycle_times                │
 │   ├── /openQuestions/ (FR-03 Items)    │    │ - task_id, lead_time_days              │
 │   ├── /decisions/ (ADR Decision Log)   │    │ - blocker_duration_hours               │
 │   ├── /actionCenter/ (Approval Ledger) │    │                                        │
 │   └── /activityLog/ (Immutable Audit)  │    │ Table: git_commit_telemetry            │
 └────────────────────────────────────────┘    │ - commit_hash, task_id, drift_hours    │
                                               └────────────────────────────────────────┘
                       ▲                                           ▲
                       │                                           │
         Transactional │ Operational                 Analytical    │ Write API
         Reads/Writes  │ Updates                     Batch Sync    │
                       │                                           │
 ┌─────────────────────┴───────────────────────────────────────────┴────────────────────┐
 │                     GOOGLE CLOUD STORAGE (Object Storage)                            │
 │  - gs://{project_id}-prd-uploads/       (Raw uploaded PDF, DOCX, spec images)        │
 │  - gs://{project_id}-meeting-audio/     (Standup audio recordings for diarization)   │
 │  - gs://{project_id}-tfstate-prod/      (Terraform state remote lock)                │
 └──────────────────────────────────────────────────────────────────────────────────────┘

```

## 9. Security, Enterprise Network Perimeter & IAM Model

Every tier adheres to the principle of least privilege, zero-trust network ingress, and regional isolation:

```
                             [ Untrusted Public Internet ]
                                          │
                                          ▼
                   ┌──────────────────────────────────────────────┐
                   │                 Cloud Armor                  │
                   │ • Enterprise WAF & Layer 7 Inspection        │
                   │ • Rate Limiting: 1,000 req/min per IP        │
                   │ • IP Deny-listing & Geo-fencing              │
                   └──────────────────────┬───────────────────────┘
                                          │
                                          ▼
                   ┌──────────────────────────────────────────────┐
                   │             Cloud Load Balancing             │
                   │ • Managed Google SSL Certificates (TLS 1.3)  │
                   │ • CDN Static Caching for Web Frontend Assets │
                   └──────────────────────┬───────────────────────┘
                                          │
                      ┌───────────────────┴───────────────────┐
                      │ VPC Serverless Connector (egress)     │
                      ▼                                       ▼
       ┌───────────────────────────────┐     ┌─────────────────────────────────┐
       │   Frontend Cloud Run Service  │     │    Backend API Cloud Run Service │
       │   Service Account:            │     │    Service Account:             │
       │   `ai-scrum-web-sa`           │     │    `ai-scrum-agent-runner`      │
       └───────────────────────────────┘     └────────────────┬────────────────┘
                                                              │
                                                              ▼
                                             ┌─────────────────────────────────┐
                                             │      Least-Privilege Roles      │
                                             ├─────────────────────────────────┤
                                             │ • roles/aiplatform.user         │
                                             │ • roles/documentai.apiUser      │
                                             │ • roles/datastore.user          │
                                             │ • roles/bigquery.dataEditor     │
                                             │ • roles/storage.objectAdmin     │
                                             │ • roles/discoveryengine.editor  │
                                             │ • roles/secretmanager.secretAcc.│
                                             └─────────────────────────────────┘

```

## 10. Summary Verification Matrix

| **Architecture Component** | **Implementation Technology** | **Primary Functional Responsibility** | 
| **Web Cockpit UI** | Next.js 15+, React 19, Radix UI, React Flow | Real-time Kanban, interactive DAG, Copilot drawer (`⌘J`), Flash Health banner. | 
| **API & Business Logic** | FastAPI, Python 3.11, Pydantic v2 | Orchestration entrypoint, provider routing, REST endpoints, WebSocket telemetry. | 
| **Multi-Agent Engine** | Vertex AI Agent Engine & ADK | 8 specialized autonomous agents powered by Gemini 3 Flash / Pro. | 
| **Document Processing** | Document AI (Layout Parser v1) | OCR, optical tokenization, table and hierarchy extraction from PRD specifications. | 
| **Knowledge Base** | Google NotebookLM + Vertex AI Search | Exact citation retrieval, source snippets, and executive audio briefings. | 
| **Operational Store** | Cloud Firestore (Native Mode) | Low-latency state persistence, 3-tier approvals, backlog hierarchy, and audit logs. | 
| **Analytical Store** | Google BigQuery | Historical sprint metrics, velocity trends, cycle times, and predictive spillover models. | 
| **Source Control Telemetry** | GitHub Tracker Provider (Native & Jira) | Evaluates commit cadence, detects stale branches, and triggers Flash Health (🟢🟡🔴). | 
| **Infrastructure & CI/CD** | Terraform & Google Cloud Build | Reproducible IaC blueprint, automated testing, Kaniko container caching, and zero-downtime Cloud Run deployments. | 
