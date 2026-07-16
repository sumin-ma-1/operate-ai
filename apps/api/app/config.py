import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "workflows"
DATA_DIR.mkdir(parents=True, exist_ok=True)
