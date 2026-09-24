"""Isolated auth app for tests. No connection to the development database."""
import os

os.environ.update(
    POSTGRES_DB="auth_test",
    POSTGRES_USER="auth_test",
    POSTGRES_PASSWORD="unused-test-password",
    AUTH_COOKIE_SECURE="false",
    AUTH_ALLOWED_ORIGINS='["http://localhost:5174"]',
)

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(engine)


def test_database():
    with Session(engine) as session:
        yield session


app.dependency_overrides[get_db] = test_database
