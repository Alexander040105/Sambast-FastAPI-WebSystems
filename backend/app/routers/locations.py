"""
/api/v1/locations — create and geocode locations.
Used by both BE-A (customer addresses) and BE-B (driver home, stops).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.location import Location
from app.models.user import User
from app.schemas.fleet import LocationCreate, LocationOut
from app.services.geocoding import geocode_address

router = APIRouter(prefix="/locations", tags=["locations"])


@router.post("", response_model=LocationOut, status_code=status.HTTP_201_CREATED)
async def create_location(
    body: LocationCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    # Build a query string for geocoding if lat/lng not provided
    geo = {"lat": body.lat, "lng": body.lng, "place_id": None}
    if body.lat is None or body.lng is None:
        address_parts = [body.line1]
        if body.line2:
            address_parts.append(body.line2)
        address_parts.extend([body.city, body.province or "", body.postal_code or ""])
        query = ", ".join(p for p in address_parts if p)
        geo = await geocode_address(
            query, manual_lat=body.lat, manual_lng=body.lng
        )

    location = Location(
        label=body.label,
        line1=body.line1,
        line2=body.line2,
        city=body.city,
        province=body.province,
        postal_code=body.postal_code,
        lat=geo.get("lat") or body.lat,
        lng=geo.get("lng") or body.lng,
        place_id=geo.get("place_id"),
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.get("/{location_id}", response_model=LocationOut)
def get_location(
    location_id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Location not found")
    return loc
