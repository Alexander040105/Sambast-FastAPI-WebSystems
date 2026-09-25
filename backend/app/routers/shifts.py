"""
/api/v1/shifts — create driver shifts.
POST /shifts — dispatcher/admin only.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.session import get_db
from app.models.driver import Driver
from app.models.driver_shift import DriverShift
from app.models.vehicle import Vehicle
from app.models.user import User
from app.schemas.fleet import ShiftCreate, ShiftOut

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
