from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import (
    BaseHTTPMiddleware,
    RequestResponseEndpoint,
)
from starlette.responses import JSONResponse, Response

from app.auth.router import router
from app.auth.security import cookie_name
from app.config import settings


_SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class BrowserSessionMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        if (
            request.method not in _SAFE_METHODS
            and request.headers.get("origin")
            not in settings.auth_allowed_origins
        ):
            return JSONResponse(
                {"detail": "Missing or untrusted Origin header"},
                status_code=403,
                headers={"Cache-Control": "no-store"},
            )

        response = await call_next(request)

        if (
            request.url.path.startswith("/auth/")
            or cookie_name() in request.cookies
        ):
            response.headers["Cache-Control"] = "no-store"

        return response


def setup_auth(app: FastAPI) -> None:
    app.add_middleware(BrowserSessionMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.auth_allowed_origins,
        allow_credentials=True,
        allow_methods=[
            "GET",
            "HEAD",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS",
        ],
        allow_headers=["Content-Type"],
    )

    app.include_router(router)