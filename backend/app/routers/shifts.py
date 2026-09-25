"""
/api/v1/shifts — create driver shifts.
POST /shifts — dispatcher/admin only.
"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.session import get_db
from app.models.driver import Driver
from app.models.driver_shift import DriverShift
from app.models.vehicle import Vehicle
from app.models.user import User
from app.schemas.fleet import ShiftCreate, ShiftOut, ShiftUpdate, Pagination

router = APIRouter(prefix="/shifts", tags=["driver-shifts"])


@router.post("", response_model=ShiftOut, status_code=status.HTTP_201_CREATED)
def create_shift(
    body: ShiftCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin")),
):
    # Validate driver exists
    driver = db.query(Driver).filter(Driver.id == body.driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    # Validate vehicle if provided
    if body.vehicle_id:
        vehicle = db.query(Vehicle).filter(Vehicle.id == body.vehicle_id).first()
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        if not vehicle.is_active:
            raise HTTPException(status_code=400, detail="Vehicle is not active")

    # Validate time window
    if body.ends_at <= body.starts_at:
        raise HTTPException(
            status_code=400,
            detail="ends_at must be after starts_at",
        )

    shift = DriverShift(
        driver_id=body.driver_id,
        vehicle_id=body.vehicle_id,
        starts_at=body.starts_at,
        ends_at=body.ends_at,
        status=body.status,
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


@router.get("", response_model=dict)
def list_shifts(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    driver_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin", "ops_manager")),
):
    q = db.query(DriverShift)
    if driver_id is not None:
        q = q.filter(DriverShift.driver_id == driver_id)
    if status_filter:
        q = q.filter(DriverShift.status == status_filter)

    total_items = q.count()
    total_pages = max(1, math.ceil(total_items / page_size))
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "data": [ShiftOut.model_validate(s).model_dump() for s in items],
        "pagination": Pagination(
            page=page,
            page_size=page_size,
            total_items=total_items,
            total_pages=total_pages,
        ).model_dump(),
    }


@router.patch("/{shift_id}", response_model=ShiftOut)
def update_shift(
    shift_id: int,
    body: ShiftUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin")),
):
    shift = db.query(DriverShift).filter(DriverShift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")

    if body.driver_id is not None:
        driver = db.query(Driver).filter(Driver.id == body.driver_id).first()
        if not driver:
            raise HTTPException(status_code=404, detail="Driver not found")

    if body.vehicle_id is not None:
        vehicle = db.query(Vehicle).filter(Vehicle.id == body.vehicle_id).first()
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
        if not vehicle.is_active:
            raise HTTPException(status_code=400, detail="Vehicle is not active")

    update_data = body.model_dump(exclude_unset=True)
    
    starts = update_data.get("starts_at", shift.starts_at)
    ends = update_data.get("ends_at", shift.ends_at)
    if ends <= starts:
        raise HTTPException(status_code=400, detail="ends_at must be after starts_at")

    for key, value in update_data.items():
        setattr(shift, key, value)

    db.commit()
    db.refresh(shift)
    return shift


@router.delete("/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shift(
    shift_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    shift = db.query(DriverShift).filter(DriverShift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="Shift not found")
    
    db.delete(shift)
    db.commit()

