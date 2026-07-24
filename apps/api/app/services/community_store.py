"""SQLite-backed community gallery posts."""

from __future__ import annotations

import json
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from app.config import COMMUNITY_DB_PATH
from app.schemas import (
    CommunityPost,
    CommunityPostSummary,
    WorkflowDefinition,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_tags(tags: list[str] | None) -> list[str]:
    if not tags:
        return []
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in tags:
        tag = raw.strip().lower()[:32]
        if not tag or tag in seen:
            continue
        seen.add(tag)
        cleaned.append(tag)
        if len(cleaned) >= 8:
            break
    return cleaned


class CommunityStore:
    def __init__(self, db_path: Path = COMMUNITY_DB_PATH) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS community_posts (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    author_name TEXT NOT NULL,
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
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_community_created
                ON community_posts(created_at DESC)
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_community_forks
                ON community_posts(fork_count DESC)
                """
            )

    def _row_to_summary(self, row: sqlite3.Row) -> CommunityPostSummary:
        return CommunityPostSummary(
            id=row["id"],
            title=row["title"],
            description=row["description"] or None,
            authorName=row["author_name"],
            tags=json.loads(row["tags_json"] or "[]"),
            forkCount=row["fork_count"],
            nodeCount=row["node_count"],
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
        )

    def _row_to_post(
        self, row: sqlite3.Row, *, include_delete_token: bool = False
    ) -> CommunityPost:
        summary = self._row_to_summary(row)
        workflow = WorkflowDefinition.model_validate(
            json.loads(row["workflow_json"])
        )
        return CommunityPost(
            **summary.model_dump(by_alias=True),
            workflow=workflow,
            deleteToken=row["delete_token"] if include_delete_token else None,
        )

    def list_posts(
        self,
        *,
        q: str | None = None,
        tag: str | None = None,
        sort: Literal["newest", "forks"] = "newest",
    ) -> list[CommunityPostSummary]:
        order = (
            "fork_count DESC, created_at DESC"
            if sort == "forks"
            else "created_at DESC"
        )
        clauses: list[str] = []
        params: list[str] = []

        if q and q.strip():
            needle = f"%{q.strip().lower()}%"
            clauses.append(
                "(LOWER(title) LIKE ? OR LOWER(description) LIKE ? "
                "OR LOWER(author_name) LIKE ? OR LOWER(tags_json) LIKE ?)"
            )
            params.extend([needle, needle, needle, needle])

        if tag and tag.strip():
            clauses.append("LOWER(tags_json) LIKE ?")
            params.append(f'%"{tag.strip().lower()}"%')

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        sql = f"SELECT * FROM community_posts {where} ORDER BY {order}"

        with self._connect() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [self._row_to_summary(row) for row in rows]

    def get_post(self, post_id: str) -> CommunityPost | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM community_posts WHERE id = ?", (post_id,)
            ).fetchone()
        if row is None:
            return None
        return self._row_to_post(row, include_delete_token=False)

    def publish(
        self,
        *,
        author_name: str,
        title: str,
        description: str | None,
        tags: list[str] | None,
        workflow: WorkflowDefinition,
    ) -> CommunityPost:
        post_id = f"cp-{uuid.uuid4().hex[:12]}"
        delete_token = secrets.token_urlsafe(24)
        now = _now()
        normalized_tags = _normalize_tags(tags)
        payload = workflow.model_dump(by_alias=True)

        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO community_posts (
                    id, title, description, author_name, tags_json,
                    workflow_json, delete_token, fork_count, node_count,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
                """,
                (
                    post_id,
                    title.strip(),
                    (description or "").strip() or None,
                    author_name.strip(),
                    json.dumps(normalized_tags),
                    json.dumps(payload, ensure_ascii=False),
                    delete_token,
                    len(workflow.nodes),
                    now,
                    now,
                ),
            )
            row = conn.execute(
                "SELECT * FROM community_posts WHERE id = ?", (post_id,)
            ).fetchone()

        assert row is not None
        return self._row_to_post(row, include_delete_token=True)

    def increment_fork_count(self, post_id: str) -> CommunityPost | None:
        now = _now()
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE community_posts
                SET fork_count = fork_count + 1, updated_at = ?
                WHERE id = ?
                """,
                (now, post_id),
            )
            row = conn.execute(
                "SELECT * FROM community_posts WHERE id = ?", (post_id,)
            ).fetchone()
        if row is None:
            return None
        return self._row_to_post(row, include_delete_token=False)

    def delete_post(self, post_id: str, delete_token: str) -> bool:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT delete_token FROM community_posts WHERE id = ?",
                (post_id,),
            ).fetchone()
            if row is None:
                return False
            if not secrets.compare_digest(row["delete_token"], delete_token):
                raise PermissionError("Invalid delete token")
            conn.execute("DELETE FROM community_posts WHERE id = ?", (post_id,))
            return True
