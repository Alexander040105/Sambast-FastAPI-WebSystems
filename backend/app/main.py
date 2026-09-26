"""
app.main — FastAPI application factory.

Boots the app, mounts CORS, and includes all routers under /api/v1.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.errors import register_error_handlers
from app.routers import drivers, vehicles, shifts, locations, dispatch, auth


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

    # ── Error envelope (§7) ───────────────────────────────────────────
    register_error_handlers(application)

    # ── API v1 routers ────────────────────────────────────────────────
    application.include_router(auth.router, prefix="/api/v1")
    application.include_router(drivers.router, prefix="/api/v1")
    application.include_router(vehicles.router, prefix="/api/v1")
    application.include_router(shifts.router, prefix="/api/v1")
    application.include_router(locations.router, prefix="/api/v1")
    application.include_router(dispatch.router, prefix="/api/v1")

    # ── Static file serving for uploads ───────────────────────────────
    uploads_dir = os.path.join(os.path.dirname(__file__), "..", "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    application.mount(
        "/uploads",
        StaticFiles(directory=uploads_dir),
        name="uploads",
    )

    @application.get("/health")
    def health():
        return {"status": "ok"}

    return application


app = create_app()
