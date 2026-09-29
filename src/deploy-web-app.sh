#!/usr/bin/env bash

set -euo pipefail

# ==============================================================================
# ⚙️ CONFIGURATION & ENVIRONMENT VARIABLES
# ==============================================================================
PROJECT_ID="${PROJECT_ID:-ai-scrum-master-510116}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="${SERVICE_NAME:-ai-scrum-master-web-app}"
VPC_CONNECTOR="${VPC_CONNECTOR:-ai-scrum-master-vpc-connector}"
REPO_NAME="${REPO_NAME:-ai-scrum-master-repo}"
STAGING_BUCKET="${STAGING_BUCKET:-ai-scrum-master-staging-bucket}"
FEEDBACK_BUCKET="${FEEDBACK_BUCKET:-ai-scrum-master-feedback}"
AI_SCRUM_MASTER_SKILLS="${AI_SCRUM_MASTER_SKILLS:-ai-scrum-master-zcore-skills-v1}"

# Image & Service Account Declarations
IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"
SA_EMAIL="s6-na-design-dev-codebeamer-sa@${PROJECT_ID}.iam.gserviceaccount.com"
BUILD_SA="projects/${PROJECT_ID}/serviceAccounts/${SA_EMAIL}"
VPC_CONNECTOR="${VPC_CONNECTOR:-ai-scrum-master-vpc-connector}"

# Application Secrets / Tokens
GHE_TOKEN="${GHE_TOKEN:-}"
SECRET_CODE="${SECRET_CODE:-AIScrumMaster!}"
CURRENT_GEMINI_MODEL="${CURRENT_GEMINI_MODEL:-gemini-2.5-flash}"

# Terminal Formatting Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}======================================================${NC}"
echo -e "${CYAN}🚀 CLOUD BUILD & CLOUD RUN DEPLOYMENT PIPELINE       ${NC}"
echo -e "${CYAN}======================================================${NC}"

# ==============================================================================
# 1. VERIFY TOOLS, SET ACTIVE PROJECT & ADC QUOTA
# ==============================================================================
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: 'gcloud' CLI is not installed.${NC}"
    exit 1
fi

echo -e "${GREEN}[1/3] Setting GCP Active Project to: ${PROJECT_ID}...${NC}"
gcloud config set project "$PROJECT_ID" --quiet

# Fix Application Default Credentials (ADC) Quota Warning
gcloud auth application-default set-quota-project "$PROJECT_ID" --quiet 2>/dev/null || true

# ==============================================================================
# 2. STEP 1: COMPILE AND BUILD CONTAINER IMAGE (CLOUD BUILD)
# ==============================================================================
echo -e "${GREEN}[2/3] 📦 Compiling and Building Docker Image via Cloud Build...${NC}"
echo -e "${CYAN}Target Image: ${IMAGE_TAG}${NC}"
echo -e "${CYAN}Staging Source: gs://${STAGING_BUCKET}/cloudbuild-staging${NC}"

gcloud builds submit \
    --tag="$IMAGE_TAG" \
    --service-account="$BUILD_SA" \
    --gcs-source-staging-dir="gs://${STAGING_BUCKET}/cloudbuild-staging" \
    --gcs-log-dir="gs://${STAGING_BUCKET}/cloudbuild-logs" \
    .

echo -e "${GREEN}✅ Build Successful!${NC}"

# ==============================================================================
# 3. STEP 2: ATOMIC DEPLOYMENT TO CLOUD RUN (WITH VPC & INGRESS)
# ==============================================================================
echo -e "${GREEN}[3/3] 🚀 Deploying and Configuring Cloud Run Service (${SERVICE_NAME})...${NC}"

# Consolidates deployment, env vars, vpc connector, and ingress into 1 single revision
gcloud run deploy "$SERVICE_NAME" \
    --image="$IMAGE_TAG" \
    --region="$REGION" \
    --platform=managed \
    --allow-unauthenticated \
    --port=8080 \
    --memory=2Gi \
    --cpu=2 \
    --service-account="$SA_EMAIL" \
    --ingress=all \
    --vpc-connector="$VPC_CONNECTOR" \
    --vpc-egress=private-ranges-only \
    --set-env-vars="GHE_TOKEN=${GHE_TOKEN},SECRET_CODE=${SECRET_CODE},GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION},GEMINI_MODEL=${CURRENT_GEMINI_MODEL},FEEDBACK_BUCKET=${FEEDBACK_BUCKET},AI_SCRUM_MASTER_SKILLS=${AI_SCRUM_MASTER_SKILLS}"

# ==============================================================================
# 4. FETCH DEPLOYED SERVICE URL
# ==============================================================================
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region="$REGION" --format='value(status.url)' 2>/dev/null || echo "N/A")

echo -e "${CYAN}======================================================${NC}"
echo -e "${GREEN}🎉 DEPLOYMENT & NETWORK CONFIGURATION SUCCESSFUL!${NC}"
echo -e "${YELLOW}🔗 Application URL: ${SERVICE_URL}${NC}"
echo -e "${CYAN}======================================================${NC}"