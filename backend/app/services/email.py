"""
SMTP email service — port of legacy _send_email_message /
_send_user_registration_otp_email (smtplib + EmailMessage, STARTTLS, 20s).
"""

import smtplib
from email.message import EmailMessage

from app.core.config import settings


def send_email(recipient: str, subject: str, body: str) -> None:
    """Send a plain-text email. Raises RuntimeError on missing creds/failure."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        raise RuntimeError(
            "Email service is not configured. Please set SMTP_USER and "
            "SMTP_PASSWORD in .env."
        )

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = recipient
    msg.set_content(body)

    try:
        with smtplib.SMTP(
            settings.SMTP_HOST, settings.SMTP_PORT, timeout=20
        ) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as exc:
        raise RuntimeError(
            "Failed to send OTP email. Please verify SMTP credentials and "
            "network access."
        ) from exc


def send_registration_otp_email(recipient_email: str, otp_code: str) -> None:
    """Port of legacy _send_user_registration_otp_email."""
    from app.services.otp import OTP_EXPIRY_SECONDS  # lazy: avoids circular import

    subject = "Sambast Registration Verification Code"
    body = (
        "Your Sambast verification code is:\n\n"
        f"{otp_code}\n\n"
        f"This code expires in {OTP_EXPIRY_SECONDS // 60} minutes. "
        "If you did not request this, please ignore this email."
    )
    send_email(recipient_email, subject, body)
