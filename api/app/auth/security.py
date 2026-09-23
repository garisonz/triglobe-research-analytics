import hashlib
import re
import secrets
from datetime import UTC, datetime

from fastapi import Request, Response
from pwdlib import PasswordHash

from app.config import settings


password_hasher = PasswordHash.recommended()

# Perform password verification work even for an unknown email.
dummy_password_hash = password_hasher.hash(
    secrets.token_urlsafe(32)
)

_TOKEN_PATTERN = re.compile(r"[A-Za-z0-9_-]{43}")


def cookie_name() -> str:
    if settings.auth_cookie_secure:
        return "__Host-triglobe_session"
    return "triglobe_session"


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def request_token_hash(request: Request) -> str | None:
    token = request.cookies.get(cookie_name())

    if token is None or _TOKEN_PATTERN.fullmatch(token) is None:
        return None

    return hash_session_token(token)


def set_session_cookie(
    response: Response,
    token: str,
    expires_at: datetime,
) -> None:
    response.set_cookie(
        key=cookie_name(),
        value=token,
        max_age=max(
            0,
            int(
                (expires_at - datetime.now(UTC)).total_seconds()
            ),
        ),
        expires=expires_at,
        path="/",
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite="lax",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=cookie_name(),
        path="/",
        secure=settings.auth_cookie_secure,
        httponly=True,
        samesite="lax",
    )