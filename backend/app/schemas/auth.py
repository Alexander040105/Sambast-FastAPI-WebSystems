"""Pydantic schemas for /api/v1/auth — BE-A T3."""

import re
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

# Same rule as legacy _validate_email_format — EmailStr is not installed.
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
CONTACT_RE = re.compile(r"\d{11}")
OTP_RE = re.compile(r"\d{6}")
PIN_RE = re.compile(r"\d{4}")


def _norm_email(v: str) -> str:
    v = (v or "").strip().lower()
    if not EMAIL_RE.fullmatch(v):
        raise ValueError("Please enter a valid email address.")
    return v


# ── Requests ────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1)
    contact_no: str
    email: str

    @field_validator("full_name", mode="before")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("contact_no")
    @classmethod
    def _check_contact(cls, v: str) -> str:
        v = v.strip()
        if not CONTACT_RE.fullmatch(v):
            raise ValueError("Contact number must be exactly 11 digits.")
        return v

    @field_validator("email")
    @classmethod
    def _check_email(cls, v: str) -> str:
        return _norm_email(v)


class OtpVerifyRequest(BaseModel):
    email: str
    otp: str

    _email_ok = field_validator("email")(_norm_email)

    @field_validator("otp")
    @classmethod
    def _check_otp(cls, v: str) -> str:
        v = (v or "").strip()
        if not OTP_RE.fullmatch(v):
            raise ValueError("Please enter a valid 6-digit code.")
        return v


class OtpResendRequest(BaseModel):
    email: str

    _email_ok = field_validator("email")(_norm_email)


class PinSetRequest(BaseModel):
    email: str
    pin: str
    pin_confirm: str

    _email_ok = field_validator("email")(_norm_email)

    @field_validator("pin")
    @classmethod
    def _check_pin(cls, v: str) -> str:
        if not PIN_RE.fullmatch(v or ""):
            raise ValueError("PIN must be exactly 4 digits.")
        return v

    @model_validator(mode="after")
    def _pins_match(self):
        if self.pin != self.pin_confirm:
            raise ValueError("PINs do not match. Please try again.")
        return self


class LoginRequest(BaseModel):
    """Staff: {email, password}. Customer: {contact_no, pin}."""
    email: Optional[str] = None
    password: Optional[str] = None
    contact_no: Optional[str] = None
    pin: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def _strip_email(cls, v):
        return v.strip().lower() if isinstance(v, str) else v

    @field_validator("contact_no", mode="before")
    @classmethod
    def _strip_contact(cls, v):
        return v.strip() if isinstance(v, str) else v


class RefreshRequest(BaseModel):
    refresh_token: str


class DriverRegisterRequest(BaseModel):
    """Public driver self-registration — POST /api/v1/auth/register/driver.
    Creates the users row (role=driver) + drivers profile atomically."""
    email: str
    password: str = Field(min_length=8)
    name: str = Field(min_length=1)
    license_no: Optional[str] = None
    phone: Optional[str] = None

    _email_ok = field_validator("email")(_norm_email)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("phone", mode="before")
    @classmethod
    def _strip_phone(cls, v):
        return v.strip() if isinstance(v, str) else v


STAFF_ROLES = ("admin", "dispatcher", "ops_manager", "driver")


class StaffUserCreate(BaseModel):
    """Admin-only staff provisioning — POST /api/v1/admin/users."""
    email: str
    name: str = Field(min_length=1)
    password: str = Field(min_length=8)
    role: str

    _email_ok = field_validator("email")(_norm_email)

    @field_validator("name", mode="before")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("role")
    @classmethod
    def _check_role(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in STAFF_ROLES:
            raise ValueError(f"Role must be one of: {', '.join(STAFF_ROLES)}.")
        return v


# ── Responses ───────────────────────────────────────────────────────────────
class UserOut(BaseModel):
    id: int
    role: str
    name: Optional[str] = None
    email: str

    model_config = {"from_attributes": True}


class RegisterResponse(BaseModel):
    user_id: int
    email_masked: str
    resend_available_in: int


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MessageResponse(BaseModel):
    message: str
