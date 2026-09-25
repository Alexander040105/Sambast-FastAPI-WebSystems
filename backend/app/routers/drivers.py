"""
/api/v1/drivers — CRUD for driver profiles.
Dispatcher + Admin only.
"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_role, get_current_user
from app.db.session import get_db
from app.models.driver import Driver
from app.models.user import User
from app.schemas.fleet import (
    DriverCreate,
    DriverOut,
    DriverUpdate,
    Pagination,
)

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
