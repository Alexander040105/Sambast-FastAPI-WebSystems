"""
app.main — FastAPI application factory.

Boots the app, mounts CORS, and includes all routers under /api/v1.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.routers import drivers, vehicles, shifts, locations, dispatch, routes, driver_app, analytics, fleet


def create_app() -> FastAPI:
    application = FastAPI(
        title="Sambast Delivery & Logistics API",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ──────────────────────────────────────────────────────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── API v1 routers ────────────────────────────────────────────────
    application.include_router(drivers.router, prefix="/api/v1")
    application.include_router(vehicles.router, prefix="/api/v1")
    application.include_router(shifts.router, prefix="/api/v1")
    application.include_router(locations.router, prefix="/api/v1")
    application.include_router(dispatch.router, prefix="/api/v1")
    application.include_router(routes.router, prefix="/api/v1")
    application.include_router(driver_app.router, prefix="/api/v1")
    application.include_router(analytics.router, prefix="/api/v1")
    application.include_router(fleet.router, prefix="/api/v1")
    application.include_router(fleet.router)  # Also supports /fleet/stream direct

    # ── Static file serving for uploads ───────────────────────────────
    uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    application.mount(
        "/uploads",
        StaticFiles(directory=uploads_dir),
        name="uploads",
    )

    # ── Error Envelope Handlers (MEGAPLAN §7.2) ────────────────────────
    @application.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        code_str = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "VALIDATION_ERROR",
        }.get(exc.status_code, "ERROR")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.detail,
                "error": {
                    "code": code_str,
                    "message": exc.detail if isinstance(exc.detail, str) else "Request error",
                    "details": exc.detail if not isinstance(exc.detail, str) else None,
                },
            },
        )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "detail": exc.errors(),
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Request validation failed",
                    "details": exc.errors(),
                },
            },
        )

    @application.get("/health")
    def health():
        return {"status": "ok"}

    return application



app = create_app()
