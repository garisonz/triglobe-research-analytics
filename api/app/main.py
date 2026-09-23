from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from app.auth.dependencies import CurrentUser
from app.auth.setup import setup_auth

from app.database import get_db


app = FastAPI(title="Backend API")
setup_auth(app)

DatabaseSession = Annotated[Session, Depends(get_db)]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/db")
def database_health(db: DatabaseSession) -> dict[str, str]:
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database unavailable",
        ) from exc

    return {"status": "ok", "database": "connected"}

@app.get("/private-example")
def private_example(user: CurrentUser):
    return {
        "message": "You are signed in",
        "user_id": str(user.id),
    }