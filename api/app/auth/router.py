from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError

from app.auth.dependencies import CurrentUser, DatabaseSession
from app.auth.models import AuthSession, User
from app.auth.schemas import (
    LoginRequest,
    RegisterRequest,
    UserPublic,
)
from app.auth.security import (
    clear_session_cookie,
    dummy_password_hash,
    hash_session_token,
    new_session_token,
    password_hasher,
    request_token_hash,
    set_session_cookie,
)
from app.config import settings


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=UserPublic,
    status_code=201,
)
def register(
    body: RegisterRequest,
    db: DatabaseSession,
) -> User:
    user = User(
        email=str(body.email).lower(),
        password_hash=password_hasher.hash(
            body.password.get_secret_value()
        ),
    )

    db.add(user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()

        existing_user = db.scalar(
            select(User.id).where(User.email == user.email)
        )

        if existing_user is not None:
            raise HTTPException(
                status_code=409,
                detail="An account with that email already exists",
            ) from exc

        raise

    db.refresh(user)
    return user


@router.post("/login", response_model=UserPublic)
def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: DatabaseSession,
) -> User:
    user = db.scalar(
        select(User).where(
            User.email == str(body.email).lower()
        )
    )

    saved_hash = (
        user.password_hash
        if user is not None
        else dummy_password_hash
    )

    valid, updated_hash = password_hasher.verify_and_update(
        body.password.get_secret_value(),
        saved_hash,
    )

    if user is None or not valid or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if updated_hash is not None:
        user.password_hash = updated_hash

    # Replace this browser's previous session.
    old_hash = request_token_hash(request)

    if old_hash is not None:
        db.execute(
            delete(AuthSession).where(
                AuthSession.token_hash == old_hash
            )
        )

    token = new_session_token()
    expires_at = datetime.now(UTC) + timedelta(
        hours=settings.auth_session_hours
    )

    db.add(
        AuthSession(
            token_hash=hash_session_token(token),
            user_id=user.id,
            expires_at=expires_at,
        )
    )

    db.commit()
    db.refresh(user)

    set_session_cookie(response, token, expires_at)
    return user


@router.get("/me", response_model=UserPublic)
def me(user: CurrentUser) -> User:
    return user


@router.post(
    "/logout",
    status_code=204,
    response_class=Response,
)
def logout(
    request: Request,
    db: DatabaseSession,
) -> Response:
    token_hash = request_token_hash(request)

    if token_hash is not None:
        db.execute(
            delete(AuthSession).where(
                AuthSession.token_hash == token_hash
            )
        )
        db.commit()

    response = Response(status_code=204)
    clear_session_cookie(response)
    return response