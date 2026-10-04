# AI Scrum Master: Enterprise GCP Deployment Proposal & Architecture Specification

## 1. System Architecture & GCP Topology

The AI Scrum Master is deployed as a cloud-native, serverless multi-agent platform orchestrated on Google Cloud Platform. The system decouples transactional application workflows from autonomous agent loops and asynchronous analytics.

```
                           INTERNET / CLIENTS
                                   │
                                   ▼
                    ┌───────────────────────────────┐
                    │   Cloud Armor (WAF & DDoS)    │
                    └──────────────┬────────────────┘
                                   │
                                   ▼
                    ┌───────────────────────────────┐
                    │ Cloud Load Balancing + CDN    │
                    └──────────────┬────────────────┘
                                   │
         ┌─────────────────────────┴────────────────────────┐
         │                                                  │
         ▼                                                  ▼
┌─────────────────────────────┐            ┌────────────────────────────────┐
│   Cloud Run (Frontend)      │            │   Cloud Run (Core API & ADK)   │
│   - Next.js / Tailwind UI   │            │   - FastAPI / Python 3.11      │
│   - Server-Side Rendering   │            │   - ADK Multi-Agent Orchestrator│
└─────────────────────────────┘            └──────────────┬─────────────────┘
                                                          │
          ┌───────────────────────────────────────────────┼──────────────────────────────┐
          │                                               │                              │
          ▼                                               ▼                              ▼
┌─────────────────────────────┐            ┌─────────────────────────────┐ ┌───────────────────────────┐
│       Document AI           │            │    Vertex AI Agent Engine   │ │     Vertex AI Search      │
│ - Enterprise Layout Parser  │            │ - Gemini 3 Flash / Pro      │ │ - Project Knowledge Store │
│ - OCR & Clause Extraction   │            │ - Agent Development Kit     │ │ - Semantic Indexing       │
└──────────────┬──────────────┘            └──────────────┬──────────────┘ └─────────────┬─────────────┘
               │                                          │                              │
               └───────────────────────┬──────────────────┴──────────────────────────────┘
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │ Eventarc / Cloud Pub/Sub      │
                       └───────────────┬───────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                │                                             │
                ▼                                             ▼
┌───────────────────────────────┐             ┌────────────────────────────────┐
│      Firestore (Native)       │             │           BigQuery             │
│ - Transactional State         │             │ - Historical Sprint Analytics  │
│ - Epics, Stories, Tasks       │             │ - Velocity, Cycle Time, Lead   │
│ - Risks, Decisions, Approvals │             │ - Long-Term Predictive Trends  │
└───────────────────────────────┘             └────────────────────────────────┘
```

---

## 2. GCP Service-to-Feature Mapping Matrix

| Proposal Feature | GCP Primary Service | Supporting Services | Functional Responsibility |
|---|---|---|---|
| **PRD Ingestion & OCR (FR-02)** | **Document AI** (Layout Parser v1) | Cloud Storage, Eventarc | Ingests PDF, DOCX, and image specs; extracts text blocks, tables, and clause hierarchies. |
| **Agent Reasoning & Ambiguity Engine (FR-03)** | **Vertex AI (Gemini 3 Flash)** | Vertex AI Agent Engine, ADK | Analyzes PRD clauses, detects missing acceptance criteria and size caps, formulates open questions. |
| **Project Knowledge & Search (FR-18, FR-19)** | **Vertex AI Search** | Cloud Storage, Cloud Functions | Grounded enterprise search across requirement versions, retrospective logs, and decisions. |
| **Backlog & Execution Hierarchy (FR-04 to FR-07)** | **Cloud Firestore** | Cloud Run API, Pydantic | Transactional storage for Epics, Stories, Tasks, QA test suites, Sprints, and Capacity models. |
| **Meeting Intelligence (FR-08 to FR-11)** | **Vertex AI + Speech-to-Text API v2** | Cloud Storage, Pub/Sub | Transcribes standup audio and notes; extracts decisions, impediments, and task updates. |
| **Dependency & Risk Radar (FR-14, FR-15)** | **Cloud Run (NetworkX / Graph Engine)** | Firestore, Vertex AI | Builds dependency DAG; tracks critical-path task aging and computes the 5-Dimensional Health Matrix. |
| **Spillover & Historical Analytics (FR-13, Sec 36)** | **BigQuery** | BigQuery Storage Write API | Ingests sprint closing snapshots; calculates spillover probability, lead time, and team velocity. |
| **Action Center & Governance (FR-22, FR-23, Sec 44)** | **Cloud Firestore + Cloud Audit Logs** | Secret Manager, Cloud IAM | Enforces 3-tier governance (*Auto-execute, Approval Required, Human-Only*) and maintains audit trails. |
| **Application Hosting & Web Interface** | **Cloud Run** | Cloud Load Balancing, Cloud Armor | Hosts the SSR web cockpit and the multi-agent microservice backend with auto-scaling to zero. |

---

## 3. Monorepo Directory Structure

The repository follows a clean, modular monorepo structure using **Turborepo** (or Make/Docker) to isolate the agent engine, frontend cockpit, data models, and Terraform definitions.

```
ai-scrum-master/
├── .github/
│   └── workflows/
│       ├── pr-validation.yaml          # Lint, unit tests, agent schema validation
│       └── release-deploy.yaml         # Build and deploy to GCP Cloud Run
├── apps/
│   ├── web/                            # Next.js 15+ / React 19 Frontend Cockpit
│   │   ├── src/
│   │   │   ├── app/                    # App Router pages (Dashboard, Studio, Backlog, etc.)
│   │   │   ├── components/             # Radix UI + Tailwind UI components
│   │   │   │   ├── canvas/             # Kanban board, DAG visualization (React Flow)
│   │   │   │   ├── copilot/            # Assistant chat drawer (⌘J)
│   │   │   │   ├── governance/         # Action Center & Approval ledger
│   │   │   │   └── studio/             # Document Studio & Open Questions cards
│   │   │   ├── hooks/                  # TanStack Query & WebSocket telemetry hooks
│   │   │   └── lib/                    # API client, Firestore client config
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   │
│   └── api/                            # Core FastAPI Backend & Orchestration Service
│       ├── src/
│       │   ├── api/                    # REST routes (/v1/projects, /v1/ingest, /v1/governance)
│       │   ├── core/                   # Config, settings, logging, Firestore/BigQuery connectors
│       │   ├── schemas/                # Pydantic v2 domain schemas (Task, Risk, Decision, etc.)
│       │   └── main.py                 # FastAPI application entrypoint
│       ├── Dockerfile
│       ├── pyproject.toml
│       └── requirements.txt
│
├── packages/
│   ├── agents/                         # Vertex AI ADK Multi-Agent Definitions
│   │   ├── src/
│   │   │   ├── orchestrator.py         # ADK master agent router & state coordinator
│   │   │   ├── understanding_agent.py  # PRD semantic analysis & Persona extraction
│   │   │   ├── ambiguity_agent.py      # Open Questions Engine (FR-03)
│   │   │   ├── backlog_agent.py        # Epic/Story/Task decomposition & Gherkin ACs
│   │   │   ├── sprint_agent.py         # Capacity, velocity buffer, and goal synthesis
│   │   │   ├── meeting_agent.py        # Standup, Review, and Retro entity extraction
│   │   │   ├── risk_agent.py           # Dependency DAG builder & 5D Health evaluator
│   │   │   └── prompts/                # Versioned System & Few-Shot Prompts (.jinja / .txt)
│   │   └── pyproject.toml
│   │
│   └── database/                       # Shared Database Layer
│       ├── firestore/                  # Collections rules, indexes, and migration helpers
│       │   ├── firestore.rules
│       │   └── firestore.indexes.json
│       └── bigquery/                   # BigQuery schemas and scheduled SQL queries
│           ├── tables/
│           │   ├── sprint_snapshots.json
│           │   └── task_cycle_times.json
│           └── queries/
│               └── spillover_risk_trend.sql
│
├── infra/                              # Infrastructure as Code (Terraform)
│   ├── terraform/
│   │   ├── environments/
│   │   │   ├── dev/
│   │   │   │   └── terraform.tfvars
│   │   │   └── prod/
│   │   │       ├── main.tf
│   │   │       ├── variables.tf
│   │   │       ├── outputs.tf
│   │   │       └── terraform.tfvars
│   │   └── modules/
│   │       ├── bigquery/               # Datasets, tables, and partitions
│   │       ├── cloud_run/              # Cloud Run services (web, api), revisions, scaling
│   │       ├── document_ai/            # Document AI processor instances
│   │       ├── firestore/              # Firestore database instance & backup policies
│   │       ├── iam/                    # Service accounts, Workload Identity, least privilege
│   │       ├── storage/                # GCS buckets for PRD uploads & meeting audio
│   │       └── vertex_ai/              # Vertex Search Datastores & Agent Engine setup
│
├── scripts/
│   ├── bootstrap_gcp.sh                # Initial GCP project provisioning & API activation
│   ├── seed_project_data.py            # Preloads Claims Automation sample PRD and team
│   └── setup_local_env.sh              # Spins up local emulators (Firestore, GCS)
│
├── cloudbuild.yaml                     # Google Cloud Build CI/CD pipeline
├── docker-compose.yaml                 # Local development environment
└── README.md
```

---

## 4. Multi-Agent Module Breakdown (Vertex AI & ADK)

Each agent in the `packages/agents/` library is an isolated agent module built with the **Vertex AI Agent Development Kit (ADK)**. They communicate via structured Pydantic schemas and share state via Firestore:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ADK ORCHESTRATOR AGENT                          │
│   - Receives events (PRD upload, Standup transcript, Timer)           │
│   - Evaluates project execution state in Firestore                     │
│   - Routes workflow tasks to specialized downstream agents             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  Understanding Agent   │      │     Meeting Agent      │      │       Risk Agent       │
│ - Document AI output   │      │ - Audio / Notes input  │      │ - Firestore tasks sync │
│ - Personas, boundaries │      │ - Extracts decisions,  │      │ - Critical Path DAG    │
│ - Passes ambiguities   │      │   blockers, tasks      │      │ - Computes 5D health   │
└───────────┬────────────┘      └───────────┬────────────┘      └───────────┬────────────┘
            │                               │                               │
            ▼                               ▼                               ▼
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│ Ambiguity Agent (FR-03)│      │   Backlog Agent (FR-04)│      │   Sprint Agent (FR-07) │
│ - Identifies gaps      │      │ - Decomposes into:     │      │ - Evaluates capacity   │
│ - Proposes solutions   │─────▶│   Epic -> Story -> QA  │─────▶│ - Generates sprint goal│
│ - Human approval gate  │      │ - Formats Gherkin ACs  │      │ - Spillover resolution │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

1. **Orchestrator Agent (`orchestrator.py`):** Acts as the workflow controller. Evaluates the incoming trigger (e.g., `EVENT_DOCUMENT_UPLOADED`), sets execution context, calls the specialized sub-agents, and enforces the governance approval ledger.
2. **Project Understanding Agent (`understanding_agent.py`):** Takes raw optical layout JSON from Document AI. Extracts structured metadata: Business Purpose, Primary Personas, and Operational Capabilities.
3. **Ambiguity & Open Questions Agent (`ambiguity_agent.py`):** Compares extracted clauses against industry standards. Formulates targeted questions with impact assessments, priority ratings, and recommended defaults for the Product Owner.
4. **Backlog Agent (`backlog_agent.py`):** Decomposes verified requirements into a 4-tier hierarchy: `Epic -> Feature -> Story -> Subtasks (Dev + QA)`. Automatically formats acceptance criteria into executable Gherkin syntax (`Given-When-Then`).
5. **Sprint Planning & Allocation Agent (`sprint_agent.py`):** Pulls developer capacity and skill vectors, applies a 10% risk buffer, and suggests the committed scope and sprint goal.
6. **Meeting Intelligence Agent (`meeting_agent.py`):** Accepts multi-speaker audio transcripts or text notes. Performs entity extraction to identify decisions, impediments, and status shifts.
7. **Risk & DAG Agent (`risk_agent.py`):** Traverses the Firestore task graph using topological sorting to find the critical path, flags idle items exceeding 48 hours, and generates the transparent 5-dimensional health indicators.

---

## 5. Infrastructure as Code (Terraform Enterprise Blueprint)

Below is the production-grade Terraform configuration for the AI Scrum Master infrastructure.

### `infra/terraform/environments/prod/main.tf`

```hcl
terraform {
  required_version = ">= 1.7.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.30.0"
    }
  }
  backend "gcs" {
    bucket = "ai-scrum-master-tfstate-prod"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# 1. Enable Required GCP APIs
locals {
  services = [
    "run.googleapis.com",
    "firestore.googleapis.com",
    "documentai.googleapis.com",
    "aiplatform.googleapis.com",
    "discoveryengine.googleapis.com",
    "bigquery.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "eventarc.googleapis.com"
  ]
}

resource "google_project_service" "enabled_apis" {
  for_each                   = toset(locals.services)
  project                    = var.project_id
  service                    = each.key
  disable_dependent_services = false
  disable_on_destroy         = false
}

# 2. Cloud Storage Buckets (PRDs and Artifacts)
resource "google_storage_bucket" "prd_upload_bucket" {
  name                        = "${var.project_id}-prd-uploads"
  location                    = var.region
  uniform_bucket_level_access = true
  versioning {
    enabled = true
  }
  cors {
    origins          = [var.app_domain]
    methods          = ["GET", "PUT", "POST", "OPTIONS"]
    response_headers = ["Content-Type", "Authorization"]
    max_age_seconds  = 3600
  }
  depends_on = [google_project_service.enabled_apis]
}

# 3. Document AI Processor (Layout Parser)
resource "google_document_ai_processor" "prd_parser" {
  provider     = google-beta
  project      = var.project_id
  location     = "us" # Document AI processor locations (us or eu)
  display_name = "prd-document-parser"
  type         = "LAYOUT_PARSER_PROCESSOR"
  depends_on   = [google_project_service.enabled_apis]
}

# 4. Cloud Firestore (Native Mode)
resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"
  concurrency_mode = "OPTIMISTIC"
  depends_on  = [google_project_service.enabled_apis]
}

# 5. BigQuery Dataset for Historical Analytics
resource "google_bigquery_dataset" "analytics_dataset" {
  dataset_id                  = "scrum_delivery_analytics"
  friendly_name               = "Scrum Delivery Analytics"
  description                 = "Historical sprint trends, velocity, and spillovers"
  location                    = var.region
  default_table_expiration_ms = null # Retain forever

  labels = {
    env = var.environment
  }
  depends_on = [google_project_service.enabled_apis]
}

resource "google_bigquery_table" "sprint_snapshots" {
  dataset_id = google_bigquery_dataset.analytics_dataset.dataset_id
  table_id   = "sprint_snapshots"

  time_partitioning {
    type  = "DAY"
    field = "sprint_end_date"
  }

  schema = <<EOF
[
  {"name": "project_id", "type": "STRING", "mode": "REQUIRED"},
  {"name": "sprint_id", "type": "STRING", "mode": "REQUIRED"},
  {"name": "planned_points", "type": "INTEGER", "mode": "REQUIRED"},
  {"name": "delivered_points", "type": "INTEGER", "mode": "REQUIRED"},
  {"name": "spillover_points", "type": "INTEGER", "mode": "REQUIRED"},
  {"name": "cycle_time_avg_days", "type": "FLOAT", "mode": "NULLABLE"},
  {"name": "sprint_end_date", "type": "TIMESTAMP", "mode": "REQUIRED"}
]
EOF
}

# 6. Service Account & IAM (Least Privilege)
resource "google_service_account" "agent_runner_sa" {
  account_id   = "ai-scrum-agent-runner"
  display_name = "AI Scrum Master Agent Service Account"
}

resource "google_project_iam_member" "agent_roles" {
  for_each = toset([
    "roles/aiplatform.user",
    "roles/documentai.apiUser",
    "roles/datastore.user",
    "roles/bigquery.dataEditor",
    "roles/storage.objectAdmin",
    "roles/discoveryengine.editor"
  ])
  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.agent_runner_sa.email}"
}

# 7. Cloud Run Services (Frontend & Backend API)
resource "google_cloud_run_v2_service" "backend_api" {
  name     = "ai-scrum-api"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.agent_runner_sa.email

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/app-images/api:latest"
      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
      }
      env {
        name  = "PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "DOCUMENT_AI_PROCESSOR_ID"
        value = google_document_ai_processor.prd_parser.id
      }
      env {
        name  = "PRD_BUCKET_NAME"
        value = google_storage_bucket.prd_upload_bucket.name
      }
      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
    }

    scaling {
      min_instance_count = 1 # Keep 1 warm instance for low agent latency
      max_instance_count = 10
    }
  }
  depends_on = [google_project_service.enabled_apis]
}

resource "google_cloud_run_v2_service" "frontend_cockpit" {
  name     = "ai-scrum-cockpit"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/app-images/web:latest"
      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
      }
      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = google_cloud_run_v2_service.backend_api.uri
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }
  }
  depends_on = [google_project_service.enabled_apis]
}

# Allow public unauthenticated access (Protected via App-level Auth / Firebase Auth)
resource "google_cloud_run_service_iam_member" "api_public" {
  location = google_cloud_run_v2_service.backend_api.location
  service  = google_cloud_run_v2_service.backend_api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_service_iam_member" "web_public" {
  location = google_cloud_run_v2_service.frontend_cockpit.location
  service  = google_cloud_run_v2_service.frontend_cockpit.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
```

### `infra/terraform/environments/prod/variables.tf`

```hcl
variable "project_id" {
  description = "The target Google Cloud Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region for deployment"
  type        = string
  default     = "europe-west3" # Frankfurt (or us-central1)
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "app_domain" {
  description = "Custom domain for CORS and routing"
  type        = string
  default     = "https://scrum.enterprise.internal"
}
```

---

## 6. Automated CI/CD Pipeline (Cloud Build)

The entire build, test, containerization, and deployment sequence is automated using `cloudbuild.yaml`.

```yaml
# cloudbuild.yaml
steps:
  # 1. Run Unit Tests & Linting
  - name: 'python:3.11-slim'
    id: 'test-backend-and-agents'
    entrypoint: 'bash'
    args:
      - '-c'
      - |
        pip install poetry
        poetry install --no-root
        poetry run pytest packages/agents/tests apps/api/tests

  # 2. Build Backend Docker Image
  - name: 'gcr.io/kaniko-project/executor:latest'
    id: 'build-api-image'
    args:
      - '--destination=$_REGION-docker.pkg.dev/$PROJECT_ID/app-images/api:$SHORT_SHA'
      - '--destination=$_REGION-docker.pkg.dev/$PROJECT_ID/app-images/api:latest'
      - '--dockerfile=apps/api/Dockerfile'
      - '--context=dir://.'
      - '--cache=true'

  # 3. Build Web Cockpit Docker Image
  - name: 'gcr.io/kaniko-project/executor:latest'
    id: 'build-web-image'
    args:
      - '--destination=$_REGION-docker.pkg.dev/$PROJECT_ID/app-images/web:$SHORT_SHA'
      - '--destination=$_REGION-docker.pkg.dev/$PROJECT_ID/app-images/web:latest'
      - '--dockerfile=apps/web/Dockerfile'
      - '--context=dir://.'
      - '--cache=true'

  # 4. Deploy API to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    id: 'deploy-api-cloud-run'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'ai-scrum-api'
      - '--image=$_REGION-docker.pkg.dev/$PROJECT_ID/app-images/api:$SHORT_SHA'
      - '--region=$_REGION'
      - '--platform=managed'

  # 5. Deploy Web to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    id: 'deploy-web-cloud-run'
    entrypoint: 'gcloud'
    args:
      - 'run'
      - 'deploy'
      - 'ai-scrum-cockpit'
      - '--image=$_REGION-docker.pkg.dev/$PROJECT_ID/app-images/web:$SHORT_SHA'
      - '--region=$_REGION'
      - '--platform=managed'

substitutions:
  _REGION: 'europe-west3'

options:
  logging: CLOUD_LOGGING_ONLY
  machineType: 'E2_HIGHCPU_8'
```

---

## 7. Automated Bootstrap Script

To spin up a new environment from scratch in minutes, run the following automated shell script:

```bash
#!/usr/bin/env bash
# scripts/bootstrap_gcp.sh
set -euo pipefail

echo "=========================================================="
echo "    AI Scrum Master — GCP Environment Bootstrapper        "
echo "=========================================================="

PROJECT_ID=${1:-""}
REGION=${2:-"europe-west3"}

if [ -z "$PROJECT_ID" ]; then
  echo "Error: Target GCP Project ID is required."
  echo "Usage: ./scripts/bootstrap_gcp.sh <PROJECT_ID> [REGION]"
  exit 1
fi

echo "[1/5] Setting gcloud configuration to project: $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

echo "[2/5] Creating Artifact Registry repository for container images..."
gcloud artifacts repositories create app-images \
    --repository-format=docker \
    --location="$REGION" \
    --description="Docker images for AI Scrum Master Cockpit and API" || true

echo "[3/5] Creating Terraform state storage bucket..."
gsutil mb -p "$PROJECT_ID" -l "$REGION" "gs://${PROJECT_ID}-tfstate-prod" || true
gsutil versioning set on "gs://${PROJECT_ID}-tfstate-prod"

echo "[4/5] Initializing Terraform infrastructure..."
cd infra/terraform/environments/prod
terraform init -backend-config="bucket=${PROJECT_ID}-tfstate-prod"
terraform apply -var="project_id=${PROJECT_ID}" -var="region=${REGION}" -auto-approve

echo "[5/5] Provisioning completed successfully!"
echo "Cloud Run API & Cockpit are live."
```

---

## 8. Step-by-Step Deployment Runbook

Follow these sequential steps to deploy the application into production:

### Phase 1: Local Development & Emulators
1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/ai-scrum-master.git
   cd ai-scrum-master
   ```
2. Start the local emulators (Firestore, Cloud Storage mock):
   ```bash
   chmod +x scripts/setup_local_env.sh && ./scripts/setup_local_env.sh
   ```
3. Run the development environment:
   ```bash
   # Starts Next.js on localhost:3000 and FastAPI on localhost:8000
   docker compose up --build
   ```

### Phase 2: Deploying to Google Cloud Platform
1. Authenticate with Google Cloud:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```
2. Execute the bootstrap script:
   ```bash
   ./scripts/bootstrap_gcp.sh your-actual-gcp-project-id europe-west3
   ```
3. Trigger Cloud Build deployment:
   ```bash
   gcloud builds submit --config=cloudbuild.yaml --substitutions=_REGION=europe-west3
   ```

### Phase 3: Seeding Sample Data & End-to-End Validation
Run the provided seeding script to populate the `Claims Automation` project, seed team capacities, and upload the sample PRD:
```bash
python scripts/seed_project_data.py --project-id=your-actual-gcp-project-id
```
Open the output Cloud Run web cockpit URL (`https://ai-scrum-cockpit-*.run.app`) to test the real-time pipeline.