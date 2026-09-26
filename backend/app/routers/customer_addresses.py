"""
/api/v1/customer_addresses — a customer's saved delivery addresses.

customer_addresses rows point at locations rows; creating an address
geocodes it first (services/geocoding.py) so dispatch can compute
distance later. is_default is exclusive per customer.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.session import get_db
from app.models.customer import Customer
from app.models.customer_address import CustomerAddress
from app.models.location import Location
from app.schemas.customer_addresses import (
    AddressCreate,
    AddressOut,
    AddressUpdate,
)
from app.schemas.fleet import LocationOut
from app.services.geocoding import geocode_address

router = APIRouter(prefix="/customer_addresses", tags=["customer_addresses"])


def _get_own_address(db: Session, customer: Customer, address_id: int) -> CustomerAddress:
    saved = db.query(CustomerAddress).filter(
        CustomerAddress.id == address_id,
        CustomerAddress.customer_id == customer.id,
    ).first()
    if not saved:
        raise HTTPException(status_code=404, detail="Address not found")
    return saved


def _to_out(db: Session, saved: CustomerAddress) -> AddressOut:
    location = db.query(Location).filter(Location.id == saved.location_id).first()
    return AddressOut(
        id=saved.id,
        label=saved.label,
        is_default=saved.is_default,
        location=LocationOut.model_validate(location),
        created_at=saved.created_at,
    )


def _clear_default(db: Session, customer_id: int) -> None:
    others = db.query(CustomerAddress).filter(
        CustomerAddress.customer_id == customer_id,
        CustomerAddress.is_default.is_(True),
    ).all()
    for other in others:
        other.is_default = False


@router.get("", response_model=dict)
def list_addresses(
    db: Session = Depends(get_db),
    customer: Customer = Depends(require_role("customer")),
):
    saved = db.query(CustomerAddress).filter(
        CustomerAddress.customer_id == customer.id
    ).order_by(CustomerAddress.created_at.desc()).all()

    data = []
    for address in saved:
        data.append(_to_out(db, address).model_dump())
    return {"data": data}


@router.post("", response_model=AddressOut, status_code=status.HTTP_201_CREATED)
async def create_address(
    body: AddressCreate,
    db: Session = Depends(get_db),
    customer: Customer = Depends(require_role("customer")),
):
    geocoded = await geocode_address(
        ", ".join(part for part in [body.line1, body.city] if part),
        manual_lat=body.lat,
        manual_lng=body.lng,
    )

    # one transaction: location row + customer_addresses row
    location = Location(
        line1=body.line1,
        line2=body.line2,
        city=body.city,
        province=body.province,
        postal_code=body.postal_code,
        lat=geocoded["lat"],
        lng=geocoded["lng"],
        place_id=geocoded["place_id"],
    )
    db.add(location)
    db.flush()

    if body.is_default:
        _clear_default(db, customer.id)

    saved = CustomerAddress(
        customer_id=customer.id,
        location_id=location.id,
        label=body.label,
        is_default=body.is_default,
    )
    db.add(saved)
    db.commit()
    db.refresh(saved)
    return _to_out(db, saved)


@router.get("/{address_id}", response_model=AddressOut)
def get_address(
    address_id: int,
    db: Session = Depends(get_db),
    customer: Customer = Depends(require_role("customer")),
):
    saved = _get_own_address(db, customer, address_id)
    return _to_out(db, saved)


@router.patch("/{address_id}", response_model=AddressOut)
def update_address(
    address_id: int,
    body: AddressUpdate,
    db: Session = Depends(get_db),
    customer: Customer = Depends(require_role("customer")),
):
    saved = _get_own_address(db, customer, address_id)
    update_data = body.model_dump(exclude_unset=True)

    if update_data.get("is_default"):
        _clear_default(db, customer.id)

    # address fields live on the locations row, label/default on ours
    location = db.query(Location).filter(Location.id == saved.location_id).first()
    for key in ("line1", "line2", "city", "province", "postal_code"):
        if key in update_data:
            setattr(location, key, update_data.pop(key))

    for key, value in update_data.items():
        setattr(saved, key, value)

    db.commit()
    db.refresh(saved)
    return _to_out(db, saved)


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: int,
    db: Session = Depends(get_db),
    customer: Customer = Depends(require_role("customer")),
):
    saved = _get_own_address(db, customer, address_id)

    # keep the locations row — old orders may still point at it
    db.delete(saved)
    db.commit()
