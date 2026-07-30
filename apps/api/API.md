# API summary

HTTP endpoints exposed by `apps/api` (FastAPI). Default local base: `http://localhost:8000` (proxied from the web app as `/backend`). Community routes on a public Open Space host are often served under `/community-backend`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/execute/stream` | Run workflow (SSE progress) |
| `POST` | `/execute` | Run workflow (JSON) |
| `GET` | `/models` | List Ollama models |
| `GET` | `/models/catalog` | Providers + models catalog |
| `GET` | `/forge/models` | List Forge checkpoints |
| `GET/PUT` | `/settings/forge` | Default Forge checkpoint |
| `GET/PUT` | `/settings/providers` | Cloud API key status / update |
| `POST` | `/settings/providers/test` | Test a provider connection |
| `POST` | `/ollama/pull` | Pull Ollama model (SSE) |
| `DELETE` | `/ollama/models/{name}` | Delete Ollama model |
| `GET/POST` | `/workflows` | List / save workflows |
| `GET/DELETE` | `/workflows/{id}` | Get / delete workflow |
| `GET` | `/community` | List community posts (`q`, `tag`, `sort`) |
| `GET` | `/community/{id}` | Community post detail + workflow snapshot |
| `POST` | `/community` | Publish (Bearer Google ID token) |
| `POST` | `/community/{id}/fork` | Fork into a private workflow |
| `DELETE` | `/community/{id}` | Delete post (Bearer; creator only) |

For public Open Space deploy (Postgres + Docker + Nginx), see [`deploy/DEPLOY.md`](../../deploy/DEPLOY.md).
