# Deploy public Open Space

Public Open Space runs as a hosted stack (Postgres + API + Web + Nginx).  
Users run the **local editor** on their PC; the public site is for browse / publish / delete / “Open as new” → local import.

## Architecture

```text
User PC (local)                         VPS (public)
┌─────────────────────┐                 ┌──────────────────────────────┐
│ Next :3000          │  publish/delete │ Nginx :80                    │
│ Local API :8000     │ ──────────────► │  ├─ web :3000                │
│ Ollama / Forge /keys│                 │  └─ api :8000 ──► Postgres   │
└─────────────────────┘                 └──────────────────────────────┘
        ▲
        │ Open as new → http://localhost:3000/editor/import?postId=…
```

## 1. Google OAuth

1. Create an OAuth **Web** client in Google Cloud Console.
2. Authorized JavaScript origins:
   - `http://localhost:3000` (local editor)
   - `https://YOUR_PUBLIC_DOMAIN` (public Open Space)
3. Use the same Client ID in:
   - Local: `apps/web/.env.local` → `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   - Local: `apps/api/.env` → `GOOGLE_CLIENT_ID`
   - Public: `deploy/open-space.env` → `GOOGLE_CLIENT_ID`

## 2. VPS deploy

```bash
git clone <this-repo> && cd operate-ai
cp deploy/open-space.env.example deploy/open-space.env
# edit POSTGRES_PASSWORD, GOOGLE_CLIENT_ID, CORS_ORIGINS, NEXT_PUBLIC_LOCAL_EDITOR_URL

docker compose -f docker-compose.open-space.yml --env-file deploy/open-space.env up -d --build
```

Open `http://YOUR_VPS_IP/` or put TLS in front (Caddy / Cloudflare / certbot).

Health checks:

- `http://YOUR_HOST/backend/health` → `{"status":"ok"}`
- `http://YOUR_HOST/` → Open Space landing
- `http://YOUR_HOST/open-space` or `/community` → gallery UI
- `http://YOUR_HOST/community-backend/community` → JSON list

## 3. Point local editors at the public Open Space API

On each user’s machine (`apps/web/.env.local`):

```env
NEXT_PUBLIC_API_URL=/backend
NEXT_PUBLIC_COMMUNITY_API_URL=https://YOUR_PUBLIC_DOMAIN/community-backend
NEXT_PUBLIC_OPEN_SPACE_URL=https://YOUR_PUBLIC_DOMAIN
NEXT_PUBLIC_LOCAL_EDITOR_URL=http://localhost:3000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same client id>
```

With `NEXT_PUBLIC_OPEN_SPACE_URL` set, the **local** home “Open Space” button and
`/community` routes open the **public** site (not a second local gallery).
Publish from the local editor writes to the public API.

`COMMUNITY_API_PROXY_TARGET` is only used when `NEXT_PUBLIC_COMMUNITY_API_URL` is a relative path (`/community-backend`).
If you set a full `https://…` URL, the browser talks to the public API directly (CORS must allow `http://localhost:3000` — already covered by default regex + `CORS_ORIGINS`).

Public server `CORS_ORIGINS` should include your public web origin if it is not localhost.

## 4. Migrate existing SQLite posts (optional)

If you already have local `apps/api/data/community.sqlite3`:

```bash
cd apps/api
# DATABASE_URL must point at the public Postgres (tunnel or copy file after dump)
set DATABASE_URL=postgresql://operate:PASSWORD@HOST:5432/operate_community
.\.venv\Scripts\python.exe scripts\migrate_community_sqlite_to_postgres.py
```

## 5. Cloudflare Tunnel (optional Forge)

Public Open Space does **not** need Forge. Image generation stays on the user’s local editor.

If you ever want the **public** API to call a home Forge:

1. Run Forge with `--api`.
2. Expose it with Cloudflare Tunnel.
3. Set `FORGE_BASE_URL=https://….trycloudflare.com` in `deploy/open-space.env`.

## 6. Local-only (no VPS)

Leave `DATABASE_URL` unset → community stays on SQLite.  
Keep `NEXT_PUBLIC_COMMUNITY_API_URL=/community-backend` and `COMMUNITY_API_PROXY_TARGET=http://127.0.0.1:8000`.
