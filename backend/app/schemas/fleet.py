"""Pydantic schemas for drivers, vehicles, shifts — BE-B T3."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.auth import EMAIL_RE


# ── Driver ────────────────────────────────────────────────────────────────
class DriverCreate(BaseModel):
    """Link an existing driver-role user via user_id, OR create the user
    inline by sending email+name+password instead."""
    user_id: Optional[int] = None
    email: Optional[str] = None
    name: Optional[str] = None
    password: Optional[str] = None
    license_no: Optional[str] = None
    status: str = "active"
    home_location_id: Optional[int] = None

    @field_validator("email")
    @classmethod
    def _check_email(cls, v):
        if v is None:
            return v
        v = v.strip().lower()
        if not EMAIL_RE.fullmatch(v):
            raise ValueError("Please enter a valid email address.")
        return v

    @model_validator(mode="after")
    def _user_source(self):
        if self.user_id is not None and self.email is not None:
            raise ValueError("Provide either user_id or email, not both.")
        if self.user_id is None and self.email is None:
            raise ValueError("Provide either user_id or email+name+password.")
        if self.email is not None and (not self.name or not self.password):
            raise ValueError("email, name and password are required to create a driver user.")
        return self


class DriverUpdate(BaseModel):
    license_no: Optional[str] = None
    status: Optional[str] = None
    home_location_id: Optional[int] = None


class DriverOut(BaseModel):
    id: int
    user_id: int
    license_no: Optional[str] = None
    status: str
    home_location_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Vehicle ───────────────────────────────────────────────────────────────
class VehicleCreate(BaseModel):
    plate_no: str
    type: str
    max_weight_kg: float
    max_volume_m3: Optional[float] = None
    is_active: bool = True


class VehicleUpdate(BaseModel):
    plate_no: Optional[str] = None
    type: Optional[str] = None
    max_weight_kg: Optional[float] = None
    max_volume_m3: Optional[float] = None
    is_active: Optional[bool] = None


class VehicleOut(BaseModel):
    id: int
    plate_no: str
    type: str
    max_weight_kg: float
    max_volume_m3: Optional[float] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Driver Shift ──────────────────────────────────────────────────────────
class ShiftCreate(BaseModel):
    driver_id: int
    vehicle_id: Optional[int] = None
    starts_at: datetime
    ends_at: datetime
    status: str = "scheduled"


class ShiftUpdate(BaseModel):
    driver_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    status: Optional[str] = None


class ShiftOut(BaseModel):
    id: int
    driver_id: int
    vehicle_id: Optional[int] = None
    starts_at: datetime
    ends_at: datetime
    status: str
    created_at: datetime
    driver: Optional[DriverOut] = None
    vehicle: Optional[VehicleOut] = None

    model_config = {"from_attributes": True}


# ── Location ──────────────────────────────────────────────────────────────
class LocationCreate(BaseModel):
    label: Optional[str] = None
    line1: str
    line2: Optional[str] = None
    city: str
    province: Optional[str] = None
    postal_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None


class LocationOut(BaseModel):
    id: int
    label: Optional[str] = None
    line1: str
    line2: Optional[str] = None
    city: str
    province: Optional[str] = None
    postal_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    place_id: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Pagination ────────────────────────────────────────────────────────────
class Pagination(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int
