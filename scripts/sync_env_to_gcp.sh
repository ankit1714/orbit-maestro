#!/usr/bin/env bash
# scripts/sync_env_to_gcp.sh
# Safely synchronizes all .env variables to GCP Cloud Run services

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${2:-$(gcloud config get-value compute/region 2>/dev/null || true)}"

if [ -z "$REGION" ] || [ "$REGION" = "(unset)" ]; then
  REGION="us-central1"
fi

if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  echo "Error: No GCP Project ID found."
  exit 1
fi

ENV_FILE="$ROOT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Warning: No .env file found at $ENV_FILE. Skipping environment sync."
  exit 0
fi

echo "=========================================================="
echo "    Syncing .env Variables to GCP Cloud Run               "
echo "=========================================================="
echo "Project: $PROJECT_ID | Region: $REGION"

TMP_YAML=$(mktemp /tmp/cloudrun_env_XXXXXX.yaml)
trap 'rm -f "$TMP_YAML"' EXIT

# Generate valid YAML for Cloud Run --env-vars-file
python3 -c "
import os, sys, json
env_file = '$ENV_FILE'
target_yaml = '$TMP_YAML'

env_vars = {}
with open(env_file, 'r') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        k = k.strip()
        v = v.strip().strip('\"').strip('\'')
        env_vars[k] = v

# Ensure Cloud Run production settings
env_vars['PROJECT_ID'] = '$PROJECT_ID'
env_vars['REGION'] = '$REGION'
env_vars['ENVIRONMENT'] = 'prod'
# Remove reserved variables that Cloud Run injects automatically
env_vars.pop('PORT', None)

with open(target_yaml, 'w') as out:
    for k, v in env_vars.items():
        v_escaped = v.replace('\\\\', '\\\\\\\\').replace('\"', '\\\\\"')
        out.write(f'{k}: \"{v_escaped}\"\n')

print(f'Prepared {len(env_vars)} environment variables for Cloud Run.')
"

# 1. Update ai-scrum-api with environment variables
echo "Updating Cloud Run service: ai-scrum-api..."
CLOUDSDK_METRICS_ENVIRONMENT="${CLOUDSDK_METRICS_ENVIRONMENT:+$CLOUDSDK_METRICS_ENVIRONMENT }datacloud.gemini-cli" \
gcloud run services update ai-scrum-api \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --env-vars-file="$TMP_YAML" \
  --quiet

# 2. Update ai-scrum-cockpit with public client ID if present
GOOGLE_CLIENT_ID=$(grep -E '^[[:space:]]*GOOGLE_CLIENT_ID=' "$ENV_FILE" | head -n 1 | cut -d '=' -f2- | tr -d '\"' | tr -d "'" | tr -d ' ' || true)
if [ -n "$GOOGLE_CLIENT_ID" ]; then
  echo "Updating Cloud Run service: ai-scrum-cockpit with NEXT_PUBLIC_GOOGLE_CLIENT_ID..."
  CLOUDSDK_METRICS_ENVIRONMENT="${CLOUDSDK_METRICS_ENVIRONMENT:+$CLOUDSDK_METRICS_ENVIRONMENT }datacloud.gemini-cli" \
  gcloud run services update ai-scrum-cockpit \
    --region="$REGION" \
    --project="$PROJECT_ID" \
    --update-env-vars="NEXT_PUBLIC_GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID" \
    --quiet
fi

echo "Environment variable synchronization to GCP complete!"
