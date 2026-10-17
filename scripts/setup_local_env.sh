#!/usr/bin/env bash
# scripts/setup_local_env.sh
set -euo pipefail

echo "=========================================================="
echo "    AI Scrum Master — Local Environment Setup             "
echo "=========================================================="

# 1. Setup Python Virtual Environment
PYTHON_BIN=""
if command -v python3.11 >/dev/null 2>&1; then
  PYTHON_BIN="python3.11"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  echo "Error: Python 3.11+ is required but neither python3.11 nor python3 was found." >&2
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "[1/3] Creating Python virtual environment using $($PYTHON_BIN --version)..."
  $PYTHON_BIN -m venv .venv
fi

echo "[2/3] Installing backend & multi-agent dependencies..."
source .venv/bin/activate
pip install --upgrade pip --quiet
pip install -r apps/api/requirements.txt --quiet
pip install pytest pytest-asyncio httpx --quiet

# 2. Setup Node / Web Cockpit dependencies
if [ -d "apps/web" ]; then
  echo "[3/3] Installing Web Cockpit npm dependencies..."
  cd apps/web && npm install --silent && cd ../..
fi

echo "=========================================================="
echo " Setup complete! Start local development with:           "
echo "   docker compose up --build                              "
echo " or run backend:                                          "
echo "   uvicorn apps.api.src.main:app --reload --port 8000     "
echo " and frontend:                                            "
echo "   cd apps/web && npm run dev                             "
echo "=========================================================="
