"""Isolated auth app for browser tests. Never connects to the development database."""
import os
from pathlib import Path
from tempfile import TemporaryDirectory

os.environ.update(
    POSTGRES_DB="auth_test",
    POSTGRES_USER="auth_test",
    POSTGRES_PASSWORD="unused-test-password",
    AUTH_COOKIE_SECURE="false",
    AUTH_ALLOWED_ORIGINS='["http://localhost:5174"]',
)

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.database import Base, get_db
from app.main import app

# Parallel auth, profile, and history requests must not share one SQLite connection.
# A temporary database keeps the tests isolated while allowing independent sessions.
test_directory = TemporaryDirectory(prefix="triglobe-auth-tests-")
test_database_path = Path(test_directory.name) / "auth.sqlite"
engine = create_engine(
    f"sqlite:///{test_database_path}",
    connect_args={"check_same_thread": False},
)
Base.metadata.create_all(engine)


def test_database():
    with Session(engine) as session:
        yield session


app.dependency_overrides[get_db] = test_database
