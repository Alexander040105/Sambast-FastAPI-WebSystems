"""
Global exception handlers — map errors to the §7 error envelope:

    { "error": { "code", "message", "details?" } }

Routers raise HTTPException with either a plain-string detail (mapped via
STATUS_CODES) or a dict detail {"code", "message", "details?"} for
domain-specific error codes (e.g. INVALID_CREDENTIALS, RESEND_COOLDOWN).
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# Default wire code per HTTP status when detail is a plain string.
STATUS_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    500: "INTERNAL_ERROR",
    503: "SERVICE_UNAVAILABLE",
}


def api_error(
    status_code: int,
    code: str,
    message: str,
    details=None,
    headers: dict | None = None,
) -> HTTPException:
    """Build an HTTPException that serializes to the §7 envelope with a
    domain-specific error code."""
    detail = {"code": code, "message": message}
    if details is not None:
        detail["details"] = details
    return HTTPException(status_code=status_code, detail=detail, headers=headers)


def _envelope(status_code: int, detail) -> dict:
    """Build the §7 error body from an HTTPException detail."""
    if isinstance(detail, dict):
        error = {
            "code": detail.get("code")
            or STATUS_CODES.get(status_code, f"HTTP_{status_code}"),
            "message": detail.get("message") or "Request failed.",
        }
        if detail.get("details") is not None:
            error["details"] = detail["details"]
        return {"error": error}
    return {
        "error": {
            "code": STATUS_CODES.get(status_code, f"HTTP_{status_code}"),
            "message": detail if isinstance(detail, str) else "Request failed.",
        }
    }


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    headers = getattr(exc, "headers", None) or {}
    return JSONResponse(
        status_code=exc.status_code,
        content=_envelope(exc.status_code, exc.detail),
        headers=headers,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    details = [
        {"loc": list(err.get("loc", [])), "msg": err.get("msg", ""), "type": err.get("type", "")}
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Request validation failed.",
                "details": details,
            }
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Unexpected server error.",
            }
        },
    )


def register_error_handlers(application: FastAPI) -> None:
    application.add_exception_handler(StarletteHTTPException, http_exception_handler)
    application.add_exception_handler(RequestValidationError, validation_exception_handler)
    application.add_exception_handler(Exception, unhandled_exception_handler)
