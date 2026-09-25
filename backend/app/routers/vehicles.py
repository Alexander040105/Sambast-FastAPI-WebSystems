"""
/api/v1/vehicles — CRUD for fleet vehicles.
Dispatcher + Admin only.
"""

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.session import get_db
from app.models.vehicle import Vehicle
from app.models.user import User
from app.schemas.fleet import (
    VehicleCreate,
    VehicleOut,
    VehicleUpdate,
    Pagination,
)

router = APIRouter(prefix="/vehicles", tags=["vehicles"])


@router.get("", response_model=dict)
def list_vehicles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin", "ops_manager")),
):
    q = db.query(Vehicle)
    if is_active is not None:
        q = q.filter(Vehicle.is_active == is_active)

    total_items = q.count()
    total_pages = max(1, math.ceil(total_items / page_size))
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "data": [VehicleOut.model_validate(v).model_dump() for v in items],
        "pagination": Pagination(
            page=page,
            page_size=page_size,
            total_items=total_items,
            total_pages=total_pages,
        ).model_dump(),
    }


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin", "ops_manager")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.post("", response_model=VehicleOut, status_code=status.HTTP_201_CREATED)
def create_vehicle(
    body: VehicleCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin")),
):
    # Check for duplicate plate number
    existing = db.query(Vehicle).filter(Vehicle.plate_no == body.plate_no).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Vehicle with plate '{body.plate_no}' already exists",
        )

    vehicle = Vehicle(
        plate_no=body.plate_no,
        type=body.type,
        max_weight_kg=body.max_weight_kg,
        max_volume_m3=body.max_volume_m3,
        is_active=body.is_active,
    )
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.patch("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(
    vehicle_id: int,
    body: VehicleUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # If updating plate_no, check for duplicates
    if body.plate_no is not None and body.plate_no != vehicle.plate_no:
        dup = db.query(Vehicle).filter(Vehicle.plate_no == body.plate_no).first()
        if dup:
            raise HTTPException(
                status_code=409,
                detail=f"Vehicle with plate '{body.plate_no}' already exists",
            )

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(vehicle, key, value)

    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin")),
):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    db.delete(vehicle)
    db.commit()
