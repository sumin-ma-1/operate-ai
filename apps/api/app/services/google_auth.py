from __future__ import annotations

from fastapi import HTTPException, Request
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token

from app.config import GOOGLE_CLIENT_ID


def _extract_bearer_token(request: Request) -> str | None:
    auth = request.headers.get("authorization")
    if not auth:
        return None
    if not auth.lower().startswith("bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    return token or None


async def get_current_google_user_id(request: Request) -> str:
    """
    Verify Google ID token from `Authorization: Bearer <id_token>`.
    Returns the `sub` claim which is stable for a user+issuer.
    """

    if not GOOGLE_CLIENT_ID:
        # Misconfiguration is a server-side problem.
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_CLIENT_ID is not configured on the server",
        )

    token = _extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization bearer token")

    try:
        claims = id_token.verify_oauth2_token(
            token, GoogleRequest(), GOOGLE_CLIENT_ID
        )
        sub = claims.get("sub")
        if not isinstance(sub, str) or not sub:
            raise ValueError("Missing sub claim")
        return sub
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {exc}") from exc

