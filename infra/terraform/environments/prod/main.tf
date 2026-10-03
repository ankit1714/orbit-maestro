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
    origins          = [var.app_domain, "*"]
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
  project          = var.project_id
  name             = "(default)"
  location_id      = var.region
  type             = "FIRESTORE_NATIVE"
  concurrency_mode = "OPTIMISTIC"
  depends_on       = [google_project_service.enabled_apis]
}

# 5. BigQuery Dataset for Historical Analytics
resource "google_bigquery_dataset" "analytics_dataset" {
  dataset_id                  = "scrum_delivery_analytics"
  friendly_name               = "Scrum Delivery Analytics"
  description                 = "Historical sprint trends, velocity, and spillovers"
  location                    = var.region
  default_table_expiration_ms = null

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

  schema = file("${path.module}/../../../../packages/database/bigquery/tables/sprint_snapshots.json")
  depends_on = [google_bigquery_dataset.analytics_dataset]
}

resource "google_bigquery_table" "task_cycle_times" {
  dataset_id = google_bigquery_dataset.analytics_dataset.dataset_id
  table_id   = "task_cycle_times"

  time_partitioning {
    type  = "DAY"
    field = "completed_at"
  }

  schema = file("${path.module}/../../../../packages/database/bigquery/tables/task_cycle_times.json")
  depends_on = [google_bigquery_dataset.analytics_dataset]
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
      min_instance_count = 1
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
