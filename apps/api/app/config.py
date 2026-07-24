import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DATA_ROOT = Path(__file__).resolve().parent.parent / "data"
DATA_DIR = DATA_ROOT / "workflows"
DATA_DIR.mkdir(parents=True, exist_ok=True)

COMMUNITY_DB_PATH = DATA_ROOT / "community.sqlite3"
COMMUNITY_PUBLISH_RATE_LIMIT = int(os.getenv("COMMUNITY_PUBLISH_RATE_LIMIT", "10"))
COMMUNITY_PUBLISH_RATE_WINDOW_SECONDS = int(
    os.getenv("COMMUNITY_PUBLISH_RATE_WINDOW_SECONDS", "3600")
)
# Max characters for a single attachment content field when publishing
COMMUNITY_MAX_ATTACHMENT_CHARS = int(
    os.getenv("COMMUNITY_MAX_ATTACHMENT_CHARS", "50000")
)
