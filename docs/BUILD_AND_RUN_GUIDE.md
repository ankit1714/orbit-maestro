# AI Scrum Master: Build & Run Guide

This guide provides end-to-end instructions for building, running, testing, and debugging the **AI Scrum Master** platform across three developer workflows:
1. **Local Terminal** (Docker Compose & Native Dev)
2. **Gemini CLI** (AI-Assisted Development & Autonomous Agent Tasks)
3. **Antigravity CLI** (Interactive Agentic TUI)

---

## 📋 System Prerequisites

Before starting, ensure your local environment meets the following requirements:

| Tool | Minimum Version | Check Command | Purpose |
|---|---|---|---|
| **Python** | 3.11+ | `python3 --version` | Backend FastAPI and Multi-Agent packages |
| **Node.js** | 20.x+ | `node --version` | Web Cockpit (Next.js 15 / React 19) |
| **npm** | 10.x+ | `npm --version` | Frontend package manager |
| **Docker** | 24.x+ | `docker --version` | Containerized development and deployment |
| **Docker Compose** | v2.20+ | `docker compose version` | Multi-container local orchestration |
| **Google Cloud SDK** *(Optional)* | 480.0+ | `gcloud --version` | GCP deployment (Cloud Run, Firestore, BigQuery) |

---

## 🖥️ 1. Build & Run via Local Terminal

### Approach A: Docker Compose (Recommended All-in-One)

Docker Compose builds and spins up both the FastAPI backend and the Next.js frontend with hot-reload volumes mounted.

#### 1. Build and Start the Stack
From the repository root (`ai-scrum-master`):
```bash
docker compose up --build
```
> **Tip:** Add `-d` to run in detached background mode:
> ```bash
> docker compose up --build -d
> ```

#### 2. Access Running Services
| Service | URL | Description |
|---|---|---|
| **Web Cockpit UI** | [http://localhost:3000](http://localhost:3000) | Next.js Frontend dashboard, kanban, and copilot |
| **FastAPI Swagger Docs** | [http://localhost:8000/docs](http://localhost:8000/docs) | Interactive OpenAPI documentation & test client |
| **API Health Check** | [http://localhost:8000/healthz](http://localhost:8000/healthz) | Service status and dependency health check |

#### 3. View Logs & Stop Containers
```bash
# Stream live logs
docker compose logs -f

# Stop and tear down containers
docker compose down
```

---

### Approach B: Native Dual-Process Development

Best for active feature coding, rapid hot-reloading, and low memory overhead.

#### 1. One-Time Environment Initialization
Run the automated initialization script to provision the Python virtual environment and install dependencies:
```bash
chmod +x scripts/setup_local_env.sh
./scripts/setup_local_env.sh
```

*(Manual setup alternative)*:
```bash
# Backend virtualenv
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r apps/api/requirements.txt
pip install pytest httpx

# Frontend packages
cd apps/web
npm install
cd ../..
```

#### 2. Start Backend Service (Terminal 1)
```bash
# 1. Activate Python virtual environment
source .venv/bin/activate

# 2. Run FastAPI with auto-reload on port 8000
uvicorn apps.api.src.main:app --reload --host 0.0.0.0 --port 8000
```

#### 3. Start Frontend Service (Terminal 2)
```bash
cd apps/web
npm run dev
```
The Web Cockpit will be live on [http://localhost:3000](http://localhost:3000).

---

### Approach C: Standalone Production Builds

#### Build Frontend Only (Next.js Standalone Build)
```bash
cd apps/web
npm run build

# Start the compiled production server
npm run start
```

#### Build Docker Images Directly
```bash
# 1. Build Backend Image
docker build -f apps/api/Dockerfile -t ai-scrum-api:latest .

# 2. Build Frontend Image
docker build -f apps/web/Dockerfile -t ai-scrum-web:latest .
```

---

### Running Automated Tests & Linting

```bash
# Activate environment
source .venv/bin/activate

# 1. Run Backend & Agent Unit Tests
pytest packages/agents/tests apps/api/tests -v

# 2. Run Frontend Linting
cd apps/web
npm run lint
cd ../..
```

---

## 🤖 2. Build & Run via Gemini CLI

**Gemini CLI** allows you to orchestrate the build, test, and run workflow conversationally, analyze error logs automatically, and generate new features or fixes.

### 1. Launch Gemini CLI
Navigate to the project root and launch the CLI:
```bash
cd /Users/ankitmaurya/ai-agents/ai-scrum-master
gemini
```

### 2. Common Build & Run Directives in Gemini CLI

You can issue high-level instructions directly in natural language:

- **Full Stack Build & Run:**
  > *"Build the docker images and run the full stack in the background. Verify that the health endpoint returns status 200."*
- **Run Backend & Create Project:**
  > *"Start the FastAPI server on port 8000 and test creating a new project via the `/v1/projects` endpoint."*
- **Run Frontend:**
  > *"Change directory to apps/web and run the Next.js dev server. Tell me if there are any build or TypeScript warnings."*
- **Diagnose & Fix Test Failures:**
  > *"Run pytest on `packages/agents/tests` and `apps/api/tests`. If any test fails, explain the root cause and propose a surgical fix."*
- **Check Lint & Type Safety:**
  > *"Run npm run lint in apps/web and check for any syntax or import errors."*

### 3. Using Specialized Skills with Gemini CLI
Gemini CLI has specialized skills built-in:
- Use `managing-python-dependencies` for virtualenv management and dependency changes.
- Use `google-cloud-auth-verification` before deploying to Cloud Run, BigQuery, or Vertex AI.
- Use `enforcing-resource-attribution` when executing `gcloud` or `bq` commands.

---

## 🚀 3. Build & Run via Antigravity CLI (`agy`)

**Antigravity CLI** is an interactive, agent-driven Terminal User Interface (TUI) for autonomous code generation, reasoning, building, and workspace orchestration.

### 1. Installation

#### macOS / Linux (Fast-Path Script)
Run the official installer:
```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
```
*This downloads the latest binary and adds `agy` to your system `PATH`.*

#### Windows (PowerShell)
```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```

#### Verify Installation
```bash
agy --version
```

### 2. Launch Antigravity in the Workspace

Navigate to the project root:
```bash
cd /Users/ankitmaurya/ai-agents/ai-scrum-master
agy
```

### 3. First-Time Setup & Trust Verification

When you first launch `agy` in the repository, the interactive setup wizard will guide you through:
1. **Workspace Trust Verification:** Confirm trust for `/Users/ankitmaurya/ai-agents/ai-scrum-master` to enable automated local build execution, file generation, and testing.
2. **Visual Theme Configuration:** Select your preferred terminal color theme and UI layout.
3. **Rendering Mode:** Adjust TUI performance and drawing modes according to your terminal emulator (iTerm2, Alacritty, Terminal.app, Kitty, etc.).

### 4. Executing Build & Run Workflows in Antigravity TUI

In the interactive Antigravity TUI prompt, collaborate with autonomous agents to perform complex delivery tasks:

- **Automated Environment Verification:**
  ```text
  Check if my local environment has Python 3.11, Node 20, and Docker installed. If anything is missing, guide me to install it.
  ```
- **One-Command Build & Run:**
  ```text
  Build and launch the entire AI Scrum Master stack using docker compose. Monitor the startup logs and alert me when the frontend and backend are ready.
  ```
- **Agent Test Suite Execution:**
  ```text
  Execute pytest across packages/agents and apps/api. Summarize test coverage and verify that the 7 multi-agent loops execute successfully.
  ```
- **Live Refactoring & Bug Fixing:**
  ```text
  Inspect apps/api/src/api/meetings.py, ensure all async handlers handle exceptions gracefully, and verify with pytest.
  ```

---

## 🔄 Summary: Which Approach Should You Use?

| Workflow | Best For | Command |
|---|---|---|
| **Docker Compose** | Complete out-of-the-box local stack with zero local dependency conflicts | `docker compose up --build` |
| **Native Terminal** | Fast day-to-day code iteration, breakpoint debugging, immediate hot-reload | `uvicorn ...` & `npm run dev` |
| **Gemini CLI** | Autonomous task execution, rapid multi-file refactoring, CLI agent orchestration | `gemini` |
| **Antigravity CLI** | Full-screen interactive TUI agent cockpit, guided workspace actions, trust policies | `agy` |
