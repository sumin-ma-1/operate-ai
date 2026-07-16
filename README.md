# Operate-AI

Visual editor for AI agents and LLM workflows. Build node-based workflows and execute them against local Ollama models.

## Stack

- **Frontend**: Next.js, React Flow (`@xyflow/react`), Zustand, Tailwind CSS
- **Backend**: FastAPI, httpx
- **LLM**: Ollama (`http://localhost:11434`)
- **Monorepo**: pnpm workspaces

## Project Structure

```
operate-ai/
├── apps/
│   ├── web/          # Next.js visual editor
│   └── api/          # FastAPI execution engine
├── packages/
│   └── workflow-schema/
├── docker-compose.yml
└── pnpm-workspace.yaml
```

## Prerequisites

- Node.js 18+
- pnpm
- Python 3.11+
- Ollama (local install or Docker)

## Setup

### 1. Clone and install dependencies

```bash
pnpm install
pnpm build:schema
```

### 2. Environment variables

```bash
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API URL |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | FastAPI URL for the web app |

### 3. Start Ollama

**Option A: Docker**

```bash
docker compose up -d ollama
docker exec -it operate-ai-ollama ollama pull llama3
```

**Option B: Local Ollama**

```bash
ollama serve
ollama pull llama3
```

### 4. Start the API

```bash
cd apps/api
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or from the repo root:

```bash
pnpm dev:api
```

### 5. Start the web app

```bash
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000).

## Usage

1. Click **New Workflow** on the home page.
2. The editor opens with Input → LLM → Output nodes pre-connected.
3. Select nodes to edit properties in the right panel.
4. Enter input text on the Input node.
5. Configure the LLM node (model, system prompt, user prompt template).
6. Click **Run** to execute via Ollama.
7. Click **Save** to persist the workflow.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/models` | List Ollama models |
| POST | `/execute` | Execute a workflow |
| GET | `/workflows` | List saved workflows |
| GET | `/workflows/{id}` | Get a workflow |
| POST | `/workflows` | Save a workflow |
| DELETE | `/workflows/{id}` | Delete a workflow |

## MVP Node Types

| Node | Description |
|------|-------------|
| **Input** | Workflow entry text |
| **LLM** | Ollama chat completion (`{{input}}` placeholder supported) |
| **Output** | Displays final result |

## Development Scripts

```bash
pnpm dev:web       # Start Next.js on :3000
pnpm dev:api       # Start FastAPI on :8000
pnpm build:schema  # Build shared TypeScript types
pnpm build:web     # Build Next.js app
```

## Next Steps

- Condition / Loop / Tool / Agent nodes
- Streaming responses (SSE)
- Authentication and multi-user support
- PostgreSQL persistence
- Workflow versioning and execution history
