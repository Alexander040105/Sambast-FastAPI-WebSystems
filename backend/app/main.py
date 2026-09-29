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

from app.core.errors import register_error_handlers
from app.routers import (
    admin,
    analytics,
    auth,
    categories,
    customer_addresses,
    dispatch,
    driver_app,
    drivers,
    fleet,
    locations,
    notifications,
    orders,
    payments,
    products,
    routes,
    shifts,
    tracking,
    vehicles,
)


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
    application.include_router(admin.router, prefix="/api/v1")
    application.include_router(drivers.router, prefix="/api/v1")
    application.include_router(vehicles.router, prefix="/api/v1")
    application.include_router(shifts.router, prefix="/api/v1")
    application.include_router(locations.router, prefix="/api/v1")
    application.include_router(dispatch.router, prefix="/api/v1")
    application.include_router(routes.router, prefix="/api/v1")
    application.include_router(driver_app.router, prefix="/api/v1")
    application.include_router(products.router, prefix="/api/v1")
    application.include_router(categories.router, prefix="/api/v1")
    application.include_router(orders.router, prefix="/api/v1")
    application.include_router(customer_addresses.router, prefix="/api/v1")
    application.include_router(payments.router, prefix="/api/v1")
    application.include_router(tracking.router, prefix="/api/v1")
    application.include_router(notifications.router, prefix="/api/v1")
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

    @application.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An unexpected error occurred",
                    "details": str(exc) if os.getenv("ENVIRONMENT") == "development" else None,
                },
            },
        )

    @application.get("/health")
    def health():
        return {"status": "ok"}

    return application



app = create_app()
