import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
FORGE_BASE_URL = os.getenv("FORGE_BASE_URL", "http://127.0.0.1:7860")
FORGE_DEFAULT_CHECKPOINT = os.getenv("FORGE_DEFAULT_CHECKPOINT", "").strip()
PYTHON_TOOL_TIMEOUT_SECONDS = int(os.getenv("PYTHON_TOOL_TIMEOUT_SECONDS", "30"))

# Google OAuth (ID token verification) for Open Space publish/delete.
GOOGLE_CLIENT_ID = (os.getenv("GOOGLE_CLIENT_ID") or "").strip()

# When set (e.g. public Open Space), community posts use Postgres.
# Local editor keeps SQLite when this is empty.
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip() or None

# Comma-separated extra CORS origins for the public site (e.g. https://open.example.com).
CORS_ORIGINS = [
    origin.strip()
    for origin in (os.getenv("CORS_ORIGINS") or "").split(",")
    if origin.strip()
]

DATA_ROOT = Path(__file__).resolve().parent.parent / "data"
DATA_DIR = DATA_ROOT / "workflows"
DATA_DIR.mkdir(parents=True, exist_ok=True)
SECRETS_PATH = DATA_ROOT / "secrets.json"

COMMUNITY_DB_PATH = DATA_ROOT / "community.sqlite3"
COMMUNITY_PUBLISH_RATE_LIMIT = int(os.getenv("COMMUNITY_PUBLISH_RATE_LIMIT", "10"))
COMMUNITY_PUBLISH_RATE_WINDOW_SECONDS = int(
    os.getenv("COMMUNITY_PUBLISH_RATE_WINDOW_SECONDS", "3600")
)
# Max characters for a single attachment content field when publishing
COMMUNITY_MAX_ATTACHMENT_CHARS = int(
    os.getenv("COMMUNITY_MAX_ATTACHMENT_CHARS", "50000")
)
