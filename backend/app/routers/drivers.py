"""
/api/v1/drivers — CRUD for driver profiles.
Dispatcher + Admin only.
"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from datetime import datetime, timezone
from app.core.deps import require_role, get_current_user
from app.db.session import get_db
from app.models.driver import Driver
from app.models.user import User
from app.models.route import Route
from app.models.delivery_stop import DeliveryStop
from app.models.driver_shift import DriverShift
from app.schemas.fleet import (
    DriverCreate,
    DriverOut,
    DriverUpdate,
    Pagination,
)
from app.schemas.route import DriverManifestResponse
from app.routers.routes import get_stop_response

router = APIRouter(prefix="/drivers", tags=["drivers"])


@router.get("", response_model=dict)
def list_drivers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin", "ops_manager")),
):
    q = db.query(Driver)
    if status_filter:
        q = q.filter(Driver.status == status_filter)

    total_items = q.count()
    total_pages = max(1, math.ceil(total_items / page_size))
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "data": [DriverOut.model_validate(d).model_dump() for d in items],
        "pagination": Pagination(
            page=page,
            page_size=page_size,
            total_items=total_items,
            total_pages=total_pages,
        ).model_dump(),
    }


@router.get("/{driver_id}", response_model=DriverOut)
def get_driver(
    driver_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin", "ops_manager")),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.post("", response_model=DriverOut, status_code=status.HTTP_201_CREATED)
def create_driver(
    body: DriverCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin")),
):
    # Verify the target user exists and has the 'driver' role
    user = db.query(User).filter(User.id == body.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role != "driver":
        raise HTTPException(
            status_code=400,
            detail="Target user must have role 'driver'",
        )
    # Prevent duplicate driver record for same user
    existing = db.query(Driver).filter(Driver.user_id == body.user_id).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail="A driver record already exists for this user",
        )

    driver = Driver(
        user_id=body.user_id,
        license_no=body.license_no,
        status=body.status,
        home_location_id=body.home_location_id,
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


@router.patch("/{driver_id}", response_model=DriverOut)
def update_driver(
    driver_id: int,
    body: DriverUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin")),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(driver, key, value)

    db.commit()
    db.refresh(driver)
    return driver


@router.delete("/{driver_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_driver(
    driver_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    db.delete(driver)
    db.commit()


@router.get("/{driver_id}/manifest", response_model=DriverManifestResponse)
def get_driver_manifest(
    driver_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin", "ops_manager")),
):
    """MEGAPLAN §7.3: Dispatcher / Manager view of a specific driver's route manifest."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    route = db.query(Route).filter(
        Route.driver_id == driver.id,
        Route.status.in_(["planned", "active"]),
    ).order_by(Route.id.desc()).first()

    if not route:
        today_date = datetime.now(timezone.utc).date()
        route = db.query(Route).filter(
            Route.driver_id == driver.id,
            Route.status == "completed",
            Route.date == today_date,
        ).order_by(Route.id.desc()).first()

    stops = []
    route_started = False
    if route:
        if route.status in ["active", "completed"]:
            route_started = True
        stop_records = db.query(DeliveryStop).filter(
            DeliveryStop.route_id == route.id
        ).order_by(DeliveryStop.sequence_no).all()
        stops = [get_stop_response(db, s) for s in stop_records]

    now = datetime.now(timezone.utc)
    shift = db.query(DriverShift).filter(
        DriverShift.driver_id == driver.id,
        DriverShift.starts_at <= now,
        DriverShift.ends_at >= now,
    ).first()
    shift_label = (
        f"Shift: {shift.starts_at.strftime('%H:%M')}–{shift.ends_at.strftime('%H:%M')}"
        if shift
        else "No Active Shift"
    )

    return DriverManifestResponse(
        date_label=now.strftime("%A, %B %d"),
        shift_label=shift_label,
        route_started=route_started,
        stops=stops,
        failure_reasons=[
            {"value": "recipient_unavailable", "label": "Recipient unavailable"},
            {"value": "business_closed", "label": "Business closed"},
            {"value": "address_not_found", "label": "Address not found"},
            {"value": "delivery_declined", "label": "Delivery declined"},
        ],
    )

