"""Pydantic schemas for drivers, vehicles, shifts — BE-B T3."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Driver ────────────────────────────────────────────────────────────────
class DriverCreate(BaseModel):
    user_id: int
    license_no: Optional[str] = None
    status: str = "active"
    home_location_id: Optional[int] = None


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
