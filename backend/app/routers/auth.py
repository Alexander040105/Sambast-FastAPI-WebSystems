"""
/api/v1/auth — registration OTP → PIN flow (customers), staff login,
token refresh, logout. Stateless port of the legacy Flask session flow;
all OTP state lives on the users table. Errors use the §7 envelope.
"""

from fastapi import APIRouter, Depends, Response, status
from jose import JWTError
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.errors import api_error
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.auth import (
    AccessTokenResponse,
    LoginRequest,
    MessageResponse,
    OtpResendRequest,
    OtpVerifyRequest,
    PinSetRequest,
    RefreshRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UserOut,
)
from app.services.otp import (
    OTP_RESEND_COOLDOWN_SECONDS,
    issue_otp,
    mask_email,
    verify_otp,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_INVALID_CREDENTIALS = "Invalid credentials."
_OTP_ERROR_CODES = {
    "expired": "OTP_EXPIRED",
    "max_attempts": "OTP_MAX_ATTEMPTS",
    "no_code": "OTP_NOT_FOUND",
    "invalid": "OTP_INVALID",
}


def _user_by_email(db: Session, email: str) -> User | None:
    return (
        db.query(User)
        .filter(func.lower(User.email) == email.strip().lower())
        .first()
    )


def _tokens_for(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id, user.role),
        user=UserOut.model_validate(user),
    )


def _is_registered(user: User) -> bool:
    """Any real account — customer with PIN or any staff row — counts as
    registered (staff rows must never enter the pending-customer flow)."""
    return bool(user.pin_hash or user.password_hash or user.role != "customer")


@router.post("/register", response_model=RegisterResponse)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing_contact = (
        db.query(User).filter(User.phone == body.contact_no).first()
    )
    existing_email = _user_by_email(db, body.email)

    if (
        existing_contact
        and existing_email
        and existing_contact.id != existing_email.id
    ):
        raise api_error(
            409,
            "CONFLICT",
            "Contact number and email are already linked to different accounts.",
        )

    target = existing_email or existing_contact
    if target and _is_registered(target):
        if existing_contact and existing_email:
            msg = "An account with that contact number and email already exists."
        elif existing_contact:
            msg = "An account with that contact number already exists."
        else:
            msg = "An account with that email already exists."
        raise api_error(409, "CONFLICT", msg)

    try:
        if target:
            # Pending registration — reset the row and start over.
            target.name = body.full_name
            target.phone = body.contact_no
            target.email = body.email
            user = target
        else:
            user = User(
                role="customer",
                name=body.full_name,
                phone=body.contact_no,
                email=body.email,
                is_active=True,
            )
            db.add(user)
            db.flush()

        issue_otp(db, user, is_resend=False)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise api_error(409, "CONFLICT", "Account information already exists.")
    except RuntimeError as exc:
        db.rollback()
        raise api_error(503, "EMAIL_SEND_FAILED", str(exc))
    except Exception:
        db.rollback()
        raise api_error(500, "INTERNAL_ERROR", "Failed to create account. Please try again.")

    return RegisterResponse(
        user_id=user.id,
        email_masked=mask_email(user.email),
        resend_available_in=OTP_RESEND_COOLDOWN_SECONDS,
    )


@router.post("/otp/verify")
def otp_verify(body: OtpVerifyRequest, db: Session = Depends(get_db)):
    user = _user_by_email(db, body.email)
    if user is None or user.role != "customer":
        raise api_error(400, "OTP_NOT_FOUND", "No pending verification for this email.")

    # Idempotent — already verified (or fully registered).
    if user.pin_hash or user.otp_verified:
        return {"verified": True}

    ok, message, kind = verify_otp(user, body.otp)
    db.commit()  # persist attempt counter either way
    if not ok:
        raise api_error(400, _OTP_ERROR_CODES[kind], message)
    return {"verified": True}


@router.post("/otp/resend")
def otp_resend(body: OtpResendRequest, db: Session = Depends(get_db)):
    user = _user_by_email(db, body.email)
    if user is None or user.role != "customer":
        raise api_error(
            400, "OTP_NOT_FOUND", "Registration not found. Please register again."
        )

    if user.pin_hash or user.otp_verified:
        return {"message": "Already verified."}

    try:
        ok, message, retry_after = issue_otp(db, user, is_resend=True)
        if not ok:
            db.rollback()
            if retry_after is not None:
                raise api_error(
                    429,
                    "RESEND_COOLDOWN",
                    message,
                    details={"retry_after": retry_after},
                    headers={"Retry-After": str(retry_after)},
                )
            raise api_error(429, "RESEND_LIMIT", message)
        db.commit()
    except RuntimeError as exc:
        db.rollback()
        raise api_error(503, "EMAIL_SEND_FAILED", str(exc))

    return {
        "message": "A new verification code was sent to your email.",
        "resend_available_in": OTP_RESEND_COOLDOWN_SECONDS,
    }


@router.post("/pin/set", response_model=TokenResponse)
def pin_set(body: PinSetRequest, db: Session = Depends(get_db)):
    user = _user_by_email(db, body.email)
    if user is None or user.role != "customer":
        raise api_error(400, "OTP_NOT_FOUND", "No pending registration for this email.")

    if user.pin_hash:
        raise api_error(409, "PIN_ALREADY_SET", "PIN already set. Please sign in.")
    if not user.otp_verified:
        raise api_error(
            403, "OTP_NOT_VERIFIED", "Email not verified. Please verify the OTP first."
        )

    user.pin_hash = hash_password(body.pin)
    user.otp_code_hash = None
    user.otp_expires_at = None
    user.otp_last_sent_at = None
    user.otp_attempts = 0
    user.otp_resend_count = 0
    db.commit()
    db.refresh(user)

    return _tokens_for(user)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    if body.email is not None or body.password is not None:
        if not body.email or not body.password:
            raise api_error(
                422,
                "VALIDATION_ERROR",
                "Both email and password are required for staff login.",
            )
        user = _user_by_email(db, body.email)
        if (
            user is None
            or not user.password_hash
            or not verify_password(body.password, user.password_hash)
        ):
            raise api_error(401, "INVALID_CREDENTIALS", _INVALID_CREDENTIALS)
        if not user.is_active:
            raise api_error(
                401, "ACCOUNT_INACTIVE", "Account is inactive. Please contact support."
            )
        return _tokens_for(user)

    if body.contact_no is not None or body.pin is not None:
        if not body.contact_no or not body.pin:
            raise api_error(
                422,
                "VALIDATION_ERROR",
                "Both contact_no and pin are required for customer login.",
            )
        user = db.query(User).filter(User.phone == body.contact_no).first()
        if user is None:
            raise api_error(401, "INVALID_CREDENTIALS", _INVALID_CREDENTIALS)
        if not user.pin_hash:
            raise api_error(
                403,
                "PIN_NOT_SET",
                "Account exists, but a PIN has not been set. "
                "Please complete registration.",
            )
        if not verify_password(body.pin, user.pin_hash):
            raise api_error(401, "INVALID_CREDENTIALS", _INVALID_CREDENTIALS)
        if not user.is_active:
            raise api_error(
                401, "ACCOUNT_INACTIVE", "Account is inactive. Please contact support."
            )
        return _tokens_for(user)

    raise api_error(
        422,
        "VALIDATION_ERROR",
        "Provide either {email, password} or {contact_no, pin}.",
    )


@router.post("/refresh", response_model=AccessTokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
    except JWTError:
        raise api_error(401, "INVALID_TOKEN", "Invalid or expired token.")

    if payload.get("type") != "refresh":
        raise api_error(401, "INVALID_TOKEN_TYPE", "Expected a refresh token.")

    try:
        user_id = int(payload["sub"])
    except (KeyError, ValueError):
        raise api_error(401, "INVALID_TOKEN", "Invalid or expired token.")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise api_error(401, "UNAUTHORIZED", "User not found or inactive.")

    return AccessTokenResponse(access_token=create_access_token(user.id, user.role))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="User logged out",
            category="User Activity",
        )
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
