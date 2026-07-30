"""Migrate community_posts from local SQLite to Postgres.

Usage (from apps/api, with venv activated):

  set DATABASE_URL=postgresql://operate:operate@localhost:5432/operate_community
  python scripts/migrate_community_sqlite_to_postgres.py

Optional:

  python scripts/migrate_community_sqlite_to_postgres.py --sqlite path/to/community.sqlite3
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
from pathlib import Path

# Allow `python scripts/...` from apps/api
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sqlite",
        type=Path,
        default=ROOT / "data" / "community.sqlite3",
        help="Source SQLite DB path",
    )
    args = parser.parse_args()

    database_url = (os.getenv("DATABASE_URL") or "").strip()
    if not database_url:
        print("DATABASE_URL is required", file=sys.stderr)
        return 1
    if not args.sqlite.exists():
        print(f"SQLite file not found: {args.sqlite}", file=sys.stderr)
        return 1

    import psycopg
    from psycopg.rows import dict_row

    sqlite_conn = sqlite3.connect(args.sqlite)
    sqlite_conn.row_factory = sqlite3.Row
    rows = sqlite_conn.execute("SELECT * FROM community_posts").fetchall()
    sqlite_conn.close()

    print(f"Found {len(rows)} posts in {args.sqlite}")

    with psycopg.connect(database_url, row_factory=dict_row) as pg:
        with pg.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS community_posts (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    author_name TEXT NOT NULL,
                    author_user_id TEXT,
                    tags_json TEXT NOT NULL,
                    workflow_json TEXT NOT NULL,
                    delete_token TEXT NOT NULL,
                    fork_count INTEGER NOT NULL DEFAULT 0,
                    node_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            inserted = 0
            skipped = 0
            for row in rows:
                cur.execute(
                    "SELECT 1 FROM community_posts WHERE id = %s", (row["id"],)
                )
                if cur.fetchone():
                    skipped += 1
                    continue
                author_user_id = None
                try:
                    author_user_id = row["author_user_id"]
                except (KeyError, IndexError):
                    author_user_id = None
                cur.execute(
                    """
                    INSERT INTO community_posts (
                        id, title, description, author_name, author_user_id, tags_json,
                        workflow_json, delete_token, fork_count, node_count,
                        created_at, updated_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        row["id"],
                        row["title"],
                        row["description"],
                        row["author_name"],
                        author_user_id,
                        row["tags_json"],
                        row["workflow_json"],
                        row["delete_token"],
                        row["fork_count"],
                        row["node_count"],
                        row["created_at"],
                        row["updated_at"],
                    ),
                )
                inserted += 1
        pg.commit()

    print(f"Migrated: inserted={inserted}, skipped_existing={skipped}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
