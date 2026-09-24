"""Run with: python -m unittest discover -s tests -p 'test_*.py'."""
import unittest
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from tests.auth_server import app, engine
from app.auth.models import AuthSession, User
from app.auth.security import cookie_name, hash_session_token


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app, headers={"Origin": "http://localhost:5174"})
        self.credentials = {
            "email": f"test-{uuid4()}@example.com",
            "password": "a thoughtful research password",
        }

    def tearDown(self):
        self.client.close()

    def login(self):
        self.assertEqual(self.client.post("/auth/register", json=self.credentials).status_code, 201)
        self.assertEqual(self.client.post("/auth/login", json=self.credentials).status_code, 200)

    def test_expired_and_inactive_sessions_are_rejected(self):
        self.login()
        with Session(engine) as db:
            session = db.get(AuthSession, hash_session_token(self.client.cookies[cookie_name()]))
            session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            db.commit()
        self.assertEqual(self.client.get("/auth/me").status_code, 401)
        self.assertEqual(self.client.get("/private-example").status_code, 401)
        self.assertEqual(self.client.post("/auth/login", json=self.credentials).status_code, 200)
        with Session(engine) as db:
            user = db.scalar(select(User).where(User.email == self.credentials["email"]))
            user.is_active = False
            db.commit()
        self.assertEqual(self.client.get("/auth/me").status_code, 401)
        self.assertEqual(self.client.post("/auth/login", json=self.credentials).status_code, 401)

    def test_untrusted_and_missing_origins_are_rejected(self):
        for origin in ["https://untrusted.example", "null"]:
            response = self.client.post("/auth/register", json=self.credentials, headers={"Origin": origin})
            self.assertEqual(response.status_code, 403)
        with TestClient(app) as anonymous:
            self.assertEqual(anonymous.post("/auth/logout").status_code, 403)

    def test_session_rotation_revocation_and_no_secret_fields(self):
        self.login()
        old_cookie = self.client.cookies[cookie_name()]
        response = self.client.post("/auth/login", json=self.credentials)
        self.assertEqual(set(response.json()), {"id", "email", "created_at"})
        self.assertEqual(response.headers["cache-control"], "no-store")
        self.assertNotEqual(old_cookie, self.client.cookies[cookie_name()])
        with TestClient(app) as old_browser:
            old_browser.cookies.set(cookie_name(), old_cookie)
            self.assertEqual(old_browser.get("/auth/me").status_code, 401)
        self.assertEqual(self.client.post("/auth/logout").status_code, 204)
        self.assertEqual(self.client.get("/auth/me").status_code, 401)

    def test_short_password_and_malformed_session_are_rejected(self):
        response = self.client.post("/auth/register", json={**self.credentials, "password": "short"})
        self.assertEqual(response.status_code, 422)
        self.client.cookies.set(cookie_name(), "not-a-valid-token")
        self.assertEqual(self.client.get("/auth/me").status_code, 401)


if __name__ == "__main__":
    unittest.main()
