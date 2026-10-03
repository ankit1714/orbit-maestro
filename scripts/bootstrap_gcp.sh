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
