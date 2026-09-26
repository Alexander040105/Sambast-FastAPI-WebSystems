from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.fleet import LocationOut
from app.schemas.orders import AddressIn


class AddressCreate(AddressIn):
    """POST /customer_addresses payload — the §7.2 location shape plus a
    label like 'Home'/'Office' and a default flag."""
    label: Optional[str] = Field(default=None, max_length=100)
    is_default: bool = False


class AddressUpdate(BaseModel):
    """PATCH /customer_addresses/{id} — label/default/address fields."""
    label: Optional[str] = None
    is_default: Optional[bool] = None
    line1: Optional[str] = None
    line2: Optional[str] = None
    city: Optional[str] = None
    province: Optional[str] = None
    postal_code: Optional[str] = None


class AddressOut(BaseModel):
    id: int
    label: Optional[str] = None
    is_default: bool
    location: LocationOut
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
