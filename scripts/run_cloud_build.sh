#!/usr/bin/env bash
# scripts/run_cloud_build.sh
# End-to-end Cloud Build runner for AI Scrum Master (excluding test session)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================================="
echo "    AI Scrum Master — Automated Cloud Build Pipeline      "
echo "        (Build & Deploy to Cloud Run - No Tests)          "
echo "=========================================================="

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${2:-$(gcloud config get-value compute/region 2>/dev/null || true)}"

if [ -z "$REGION" ] || [ "$REGION" = "(unset)" ]; then
  REGION="us-central1"
fi

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  echo "Error: No GCP Project ID found."
  echo "Usage: ./scripts/run_cloud_build.sh [PROJECT_ID] [REGION]"
  echo "Or configure gcloud: gcloud config set project <PROJECT_ID>"
  exit 1
fi

echo "Target Project : $PROJECT_ID"
echo "Target Region  : $REGION"
echo "Source Dir     : $ROOT_DIR"
echo ""

# Ensure active project is set
gcloud config set project "$PROJECT_ID" >/dev/null 2>&1

# 1. Ensure Artifact Registry repository exists
echo "[1/4] Checking Artifact Registry 'app-images' in $REGION..."
if ! gcloud artifacts repositories describe app-images --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "Creating Artifact Registry repository 'app-images'..."
  gcloud artifacts repositories create app-images \
    --repository-format=docker \
    --location="$REGION" \
    --project="$PROJECT_ID" \
    --description="Docker images for AI Scrum Master Cockpit and API"
else
  echo "Artifact Registry repository 'app-images' is ready."
fi

# 2. Ensure Required APIs are enabled
echo "[2/4] Verifying required GCP APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  --project="$PROJECT_ID" --quiet

# 3. Submit Cloud Build
echo "[3/5] Submitting Cloud Build (building Docker images and deploying to Cloud Run)..."
cd "$ROOT_DIR"

CLOUDSDK_METRICS_ENVIRONMENT="${CLOUDSDK_METRICS_ENVIRONMENT:+$CLOUDSDK_METRICS_ENVIRONMENT }datacloud.gemini-cli" \
gcloud builds submit \
  --config=cloudbuild.yaml \
  --project="$PROJECT_ID" \
  --substitutions="_REGION=$REGION"

# 4. Synchronize .env variables to Cloud Run
echo ""
echo "[4/5] Synchronizing .env variables to GCP Cloud Run..."
if [ -f "$ROOT_DIR/.env" ]; then
  "$SCRIPT_DIR/sync_env_to_gcp.sh" "$PROJECT_ID" "$REGION"
else
  echo "Notice: No .env file found; skipping variable synchronization."
fi

# 5. Display deployed Cloud Run service endpoints
echo ""
echo "[5/5] Cloud Build & Deployment succeeded! Fetching service URLs..."
echo "=========================================================="

API_URL=$(gcloud run services describe ai-scrum-api --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null || echo "Not Found")
COCKPIT_URL=$(gcloud run services describe ai-scrum-cockpit --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)' 2>/dev/null || echo "Not Found")

echo " Backend API URL     : $API_URL"
echo " Web Cockpit URL     : $COCKPIT_URL"
echo "=========================================================="
echo "AI Scrum Master Cloud deployment complete."
