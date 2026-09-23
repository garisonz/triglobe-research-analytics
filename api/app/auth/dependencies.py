from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import AuthSession, User
from app.auth.security import request_token_hash
from app.database import get_db


DatabaseSession = Annotated[Session, Depends(get_db)]


def get_current_user(
    request: Request,
    db: DatabaseSession,
) -> User:
    token_hash = request_token_hash(request)

    if token_hash is not None:
        user = db.scalar(
            select(User)
            .join(
                AuthSession,
                AuthSession.user_id == User.id,
            )
            .where(
                AuthSession.token_hash == token_hash,
                AuthSession.expires_at > datetime.now(UTC),
                User.is_active.is_(True),
            )
        )

        if user is not None:
            return user

    raise HTTPException(
        status_code=401,
        detail="Not authenticated",
    )


CurrentUser = Annotated[User, Depends(get_current_user)]