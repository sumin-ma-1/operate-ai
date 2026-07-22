<h1 align="center">
  <img src="apps/web/public/retro_spaceship_thruster.gif" width="48" height="48" alt="Operate AI" style="vertical-align: middle; margin-right: 8px;" />
  Operate AI
</h1>

<p align="center">
  A visual editor for easily building AI agents and LLM workflows.
  <br> An open space for any agentic flow you envision.
</p>

<p align="center">
  <img
    src="https://github.com/user-attachments/assets/94925e22-a41f-42c2-8e22-0c66c93698ab"
    alt="Operate AI preview"
    width="900"
  />
</p>

## Overview

```mermaid
flowchart LR
  subgraph Web["apps/web · Next.js"]
    Canvas[React Flow canvas]
    Fab[Add / Execution FABs]
    Inspector[Floating inspectors]
  end

  subgraph API["apps/api · FastAPI"]
    Executor[DAG executor]
    Store[(Workflow store)]
  end

  subgraph LLM["Ollama"]
    Models[Local models]
  end

  Canvas --> Fab
  Canvas --> Inspector
  Web -->|SSE / REST| API
  Executor --> Models
  API --> Store
```

## Workflow model

```mermaid
flowchart LR
  IN[Input\n text & files] --> LLM[LLM\n Ollama chat]
  LLM --> OUT[Output\n final result]
```

| Node | Role |
|------|------|
| **Input** | Text and attachments (`.docx`, `.pdf`, images, …) |
| **LLM** | Ollama call — receives original input + upstream output |
| **Output** | Displays the final result |

Execution order follows the graph (disabled edges are skipped).

## Editor

```mermaid
flowchart TB
  subgraph Canvas["Full-width canvas"]
    N[Nodes & edges]
    MM[MiniMap · bottom-left]
    ZM[Zoom controls · bottom-center]
  end

  Add["+ FAB"] -->|add nodes| N
  Wand["Execution FAB"] -->|floating panel| Run[Run · progress · output]
  N -->|select| Insp[Node / edge inspector]
```

- **+** — add Input, LLM, or Output nodes  
- **Execution** — run workflow, live progress chain, final output, collapsible node logs  
- **Inspectors** — properties appear next to the selected node or edge  

## Quick start

**Prerequisites:** Node 18+, pnpm, Python 3.11+, [Ollama](https://ollama.com)

```bash
pnpm install
pnpm build:schema

cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

```bash
# Ollama (Docker)
docker compose up -d ollama
docker exec -it operate-ai-ollama ollama pull gemma4:e4b

# API + web (separate terminals)
pnpm dev:api
pnpm dev:web
```

Open [http://localhost:3000](http://localhost:3000) → **New Workflow** → edit nodes → **Run**.

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API |
| `NEXT_PUBLIC_API_URL` | `/backend` | Web → FastAPI proxy (`:8000`) |

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js, React Flow, Zustand, Tailwind |
| Backend | FastAPI, httpx |
| LLM | Ollama |
| Shared types | `packages/workflow-schema` |

## Repo layout

```
operate-ai/
├── apps/web/                 # Visual editor
├── apps/api/                 # Execution & persistence
├── packages/workflow-schema/ # Shared workflow types
└── docker-compose.yml        # Ollama
```

## Scripts

```bash
pnpm dev:web        # :3000
pnpm dev:api        # :8000
pnpm build:schema   # Shared TS types
pnpm build:web      # Production build
```

## API (summary)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/execute/stream` | Run workflow (SSE progress) |
| `POST` | `/execute` | Run workflow (JSON) |
| `GET` | `/models` | List Ollama models |
| `GET/POST` | `/workflows` | List / save workflows |
| `GET/DELETE` | `/workflows/{id}` | Get / delete workflow |
