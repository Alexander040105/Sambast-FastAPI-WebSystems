"""
Registration OTP service — stateless port of the legacy session-based flow.

All OTP state lives on `customers` columns (otp_code_hash, otp_expires_at,
otp_attempts, otp_last_sent_at, otp_resend_count, otp_verified) — no sessions.

Guardrails (ported exactly from legacy_code/app.py):
6-digit code, 10-min expiry, 5 attempts, 60s resend cooldown, max 3 resends.
"""

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.customer import Customer
from app.services.email import send_registration_otp_email

OTP_LENGTH = 6
OTP_EXPIRY_SECONDS = 600
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_COOLDOWN_SECONDS = 60
OTP_MAX_RESENDS = 3


def generate_otp() -> str:
    """Zero-padded numeric OTP, e.g. '004213' (port of _generate_numeric_otp)."""
    return f"{secrets.randbelow(10 ** OTP_LENGTH):0{OTP_LENGTH}d}"


def mask_email(email: str) -> str:
    """Port of legacy _mask_email."""
    if not email or "@" not in email:
        return "your registered email"

    local_part, domain_part = email.split("@", 1)
    if len(local_part) <= 1:
        masked_local = "*"
    elif len(local_part) == 2:
        masked_local = local_part[0] + "*"
    else:
        masked_local = local_part[:2] + ("*" * (len(local_part) - 2))

    return f"{masked_local}@{domain_part}"


def issue_otp(
    db: Session, user: Customer, is_resend: bool = False
) -> tuple[bool, str | None, int | None]:
    """
    Generate + email an OTP and stamp the users columns (caller commits).

    Returns (ok, error_message, retry_after). Email is sent BEFORE the
    columns are set, so a failed send leaves no cooldown state behind —
    mirrors legacy ordering. Raises RuntimeError on SMTP failure.
    """
    now = datetime.now(timezone.utc)

    if is_resend:
        resend_count = int(user.otp_resend_count or 0)
        if resend_count >= OTP_MAX_RESENDS:
            return False, "Resend limit reached. Please restart registration.", None

        if user.otp_last_sent_at is not None:
            last_sent_at = user.otp_last_sent_at
            if last_sent_at.tzinfo is None:
                last_sent_at = last_sent_at.replace(tzinfo=timezone.utc)
            elapsed = (now - last_sent_at).total_seconds()
            retry_after = int(OTP_RESEND_COOLDOWN_SECONDS - elapsed)
            if retry_after > 0:
                return (
                    False,
                    f"Please wait {retry_after} seconds before resending.",
                    retry_after,
                )

    otp_code = generate_otp()
    send_registration_otp_email(user.email, otp_code)

    user.otp_code_hash = hash_password(otp_code)
    user.otp_expires_at = now + timedelta(seconds=OTP_EXPIRY_SECONDS)
    user.otp_attempts = 0
    user.otp_last_sent_at = now
    user.otp_resend_count = int(user.otp_resend_count or 0) + 1 if is_resend else 0
    user.otp_verified = False
    return True, None, None


def verify_otp(user: Customer, code: str) -> tuple[bool, str | None, str | None]:
    """
    Check a submitted OTP against the users columns.

    Returns (ok, error_message, error_kind) where error_kind is one of
    "expired" | "max_attempts" | "no_code" | "invalid" (None on success).
    Mutates otp_* columns; caller commits.
    """
    now = datetime.now(timezone.utc)
    expires_at = user.otp_expires_at
    if expires_at is not None and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    current_attempts = int(user.otp_attempts or 0)

    if expires_at is None or now > expires_at:
        return False, "Verification code expired. Please resend a new code.", "expired"
    if current_attempts >= OTP_MAX_ATTEMPTS:
        return (
            False,
            "Too many invalid attempts. Please resend a new code.",
            "max_attempts",
        )
    if not user.otp_code_hash:
        return (
            False,
            "No active verification code found. Please resend a new code.",
            "no_code",
        )
    if verify_password(code, user.otp_code_hash):
        user.otp_verified = True
        user.otp_code_hash = None
        user.otp_expires_at = None
        user.otp_attempts = 0
        return True, None, None

    current_attempts += 1
    user.otp_attempts = current_attempts
    remaining = OTP_MAX_ATTEMPTS - current_attempts
    if remaining > 0:
        return False, f"Invalid code. {remaining} attempt(s) remaining.", "invalid"
    return False, "Too many invalid attempts. Please resend a new code.", "max_attempts"
