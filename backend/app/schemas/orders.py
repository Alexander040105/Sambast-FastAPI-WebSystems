from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------------------------------------------------------------------------
# Inputs
# ---------------------------------------------------------------------------

class OrderItemIn(BaseModel):
    """One line in a quote/order request — qty + unit only, prices are
    recomputed server-side and never taken from the client."""
    product_id: int
    quantity: int = Field(..., ge=1)
    unit: Optional[str] = None


class AddressIn(BaseModel):
    """Delivery address — the §7.2 location shape. lat/lng are optional
    manual overrides (skips Nominatim when both are sent)."""
    line1: str = Field(..., min_length=1, max_length=255)
    line2: Optional[str] = None
    city: str = Field(..., min_length=1, max_length=100)
    province: Optional[str] = None
    postal_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None

    @field_validator("line1", "city", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


class QuoteRequest(BaseModel):
    items: List[OrderItemIn] = Field(..., min_length=1)
    address: Optional[AddressIn] = None
    customer_address_id: Optional[int] = None


class OrderCreate(BaseModel):
    items: List[OrderItemIn] = Field(..., min_length=1)
    address: Optional[AddressIn] = None
    customer_address_id: Optional[int] = None
    delivery_window_start: Optional[datetime] = None
    delivery_window_end: Optional[datetime] = None
    payment_method: str = "cash"


class CancelRequest(BaseModel):
    reason: str = Field(..., min_length=1)

    @field_validator("reason", mode="before")
    @classmethod
    def _strip_reason(cls, v):
        return v.strip() if isinstance(v, str) else v


# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

class QuoteItemOut(BaseModel):
    product_id: int
    name: str
    quantity: int
    selected_unit: str
    unit_multiplier: Decimal
    base_price_at_time: Decimal
    discount_amount_at_time: Decimal
    unit_price: Decimal
    line_total: Decimal


class QuoteSummaryOut(BaseModel):
    subtotal: Decimal
    discount_total: Decimal
    delivery_fee: Decimal
    total: Decimal


class QuoteOut(BaseModel):
    items: List[QuoteItemOut]
    summary: QuoteSummaryOut


class OrderItemOut(BaseModel):
    id: int
    product_id: Optional[int] = None
    quantity: int
    selected_unit: Optional[str] = None
    unit_multiplier: Decimal
    base_price_at_time: Decimal
    discount_amount_at_time: Decimal
    price_at_time: Decimal

    model_config = ConfigDict(from_attributes=True)


class PaymentOut(BaseModel):
    id: int
    method: str
    amount: Decimal
    status: str
    reference: Optional[str] = None
    paid_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class OrderOut(BaseModel):
    id: int
    order_no: str
    customer_id: int
    status: str
    subtotal: Decimal
    discount_total: Decimal
    delivery_fee: Decimal
    total_price: Decimal
    delivery_location_id: Optional[int] = None
    delivery_window_start: Optional[datetime] = None
    delivery_window_end: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    created_at: datetime
    items: List[OrderItemOut] = []

    model_config = ConfigDict(from_attributes=True)


class StatusEventOut(BaseModel):
    status: str
    note: Optional[str] = None
    lat: Optional[Decimal] = None
    lng: Optional[Decimal] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrderStatusOut(BaseModel):
    order_no: str
    status: str
    delivery_id: Optional[int] = None
    delivery_status: Optional[str] = None
    cancellation_reason: Optional[str] = None
    history: List[StatusEventOut] = []
