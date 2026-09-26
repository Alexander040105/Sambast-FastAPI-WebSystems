"""
/api/v1/orders — quote, place, list, detail, status, cancel (BE-A T6).

Placement flow (one transaction):
    items → pricing.build_validated_order_items (server-side reprice)
    → delivery address → locations row (+ optional saved-address reuse)
    → delivery_fee via services/costing.py
    → orders row (READY_FOR_DISPATCH so the dispatch queue sees it)
    → order_items rows   → payments row   → notification email
"""

import math
import random
import string
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.errors import api_error
from app.db.session import get_db
from app.models.customer import Customer
from app.models.customer_address import CustomerAddress
from app.models.delivery import Delivery
from app.models.delivery_status import DeliveryStatus
from app.models.location import Location
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.payment import Payment
from app.models.user import User
from app.schemas.fleet import Pagination
from app.schemas.orders import (
    AddressIn,
    CancelRequest,
    OrderCreate,
    OrderItemOut,
    OrderOut,
    OrderStatusOut,
    QuoteOut,
    QuoteRequest,
    StatusEventOut,
)
from app.services.costing import delivery_fee_for_location
from app.services.geocoding import geocode_address
from app.services.notifications import notify_order_status
from app.services.pricing import build_validated_order_items

router = APIRouter(prefix="/orders", tags=["orders"])

# CANCELLED is reachable from any pre-delivery stage (MEGAPLAN §7.2)
CANCELLABLE_STATUSES = ("PENDING", "CONFIRMED", "READY_FOR_DISPATCH", "ASSIGNED")


def _is_customer(user) -> bool:
    return getattr(user, "role", None) == "customer"


def _generate_order_no(db: Session) -> str:
    """Port of legacy generate_order_no — ORD- + 8 random digits, retry on
    the (rare) collision with the unique column."""
    while True:
        order_no = "ORD-" + "".join(random.choices(string.digits, k=8))
        exists = db.query(Order).filter(Order.order_no == order_no).first()
        if not exists:
            return order_no


async def _resolve_location(
    db: Session,
    user,
    address: Optional[AddressIn],
    customer_address_id: Optional[int],
) -> Location:
    """Turn the request's address input into a locations row.

    customer_address_id  → reuse the saved address's location (must be the
                           caller's own — leaking someone else's address is
                           worse than a 404)
    address              → geocode (or use manual lat/lng) then insert
    """
    if customer_address_id is not None:
        if not _is_customer(user):
            raise api_error(
                403, "FORBIDDEN", "Saved addresses belong to customers."
            )
        saved = db.query(CustomerAddress).filter(
            CustomerAddress.id == customer_address_id,
            CustomerAddress.customer_id == user.id,
        ).first()
        if not saved:
            raise HTTPException(status_code=404, detail="Saved address not found")
        location = db.query(Location).filter(
            Location.id == saved.location_id
        ).first()
        if not location:
            raise HTTPException(status_code=404, detail="Address location not found")
        return location

    if address is None:
        raise api_error(
            422, "VALIDATION_ERROR",
            "Provide either 'address' or 'customer_address_id'.",
        )

    geocoded = await _geocode(address)
    location = Location(
        line1=address.line1,
        line2=address.line2,
        city=address.city,
        province=address.province,
        postal_code=address.postal_code,
        lat=geocoded["lat"],
        lng=geocoded["lng"],
        place_id=geocoded["place_id"],
    )
    db.add(location)
    db.flush()
    return location


async def _geocode(address: AddressIn) -> dict:
    return await geocode_address(
        ", ".join(part for part in [address.line1, address.city] if part),
        manual_lat=address.lat,
        manual_lng=address.lng,
    )


async def _resolve_coords(
    db: Session,
    user,
    address: Optional[AddressIn],
    customer_address_id: Optional[int],
):
    """Quote path — resolve the delivery pin WITHOUT writing a locations
    row (a preview must not pollute the table)."""
    if customer_address_id is not None:
        if not _is_customer(user):
            raise api_error(403, "FORBIDDEN", "Saved addresses belong to customers.")
        saved = db.query(CustomerAddress).filter(
            CustomerAddress.id == customer_address_id,
            CustomerAddress.customer_id == user.id,
        ).first()
        if not saved:
            raise HTTPException(status_code=404, detail="Saved address not found")
        location = db.query(Location).filter(
            Location.id == saved.location_id
        ).first()
        return (float(location.lat), float(location.lng)) if location else (None, None)

    if address is None:
        return (None, None)

    geocoded = await _geocode(address)
    return geocoded["lat"], geocoded["lng"]


def _get_order_or_404(db: Session, order_no: str) -> Order:
    order = db.query(Order).filter(Order.order_no == order_no).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _check_can_see(order: Order, user) -> None:
    if _is_customer(user) and order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found")


def _order_out(db: Session, order: Order) -> OrderOut:
    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    data = OrderOut.model_validate(order).model_dump()
    data["items"] = [
        OrderItemOut.model_validate(item).model_dump() for item in items
    ]
    return OrderOut.model_validate(data)


@router.post("/quote", response_model=QuoteOut)
async def quote_order(
    body: QuoteRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Preview pricing — same recompute as POST /orders, writes nothing."""
    priced = build_validated_order_items(db, [item.model_dump() for item in body.items])

    if body.address or body.customer_address_id:
        lat, lng = await _resolve_coords(
            db, user, body.address, body.customer_address_id
        )
        delivery_fee = delivery_fee_for_location(lat, lng)
    else:
        delivery_fee = Decimal("0.00")

    summary = priced["summary"]
    return QuoteOut(
        items=priced["items"],
        summary={
            "subtotal": summary["subtotal"],
            "discount_total": summary["discount_total"],
            "delivery_fee": delivery_fee,
            "total": summary["total"] + delivery_fee,
        },
    )


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    body: OrderCreate,
    db: Session = Depends(get_db),
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    user=Depends(get_current_user),
):
    if not _is_customer(user):
        raise api_error(
            403, "FORBIDDEN", "Only customers can place orders."
        )

    if idempotency_key:
        existing = db.query(Order).filter(
            Order.idempotency_key == idempotency_key
        ).first()
        if existing:
            raise api_error(
                409, "CONFLICT",
                "Order already placed with this Idempotency-Key.",
                details={"order_no": existing.order_no},
            )

    priced = build_validated_order_items(
        db, [item.model_dump() for item in body.items]
    )
    location = await _resolve_location(
        db, user, body.address, body.customer_address_id
    )
    delivery_fee = delivery_fee_for_location(location.lat, location.lng)

    subtotal = priced["summary"]["subtotal"]
    discount_total = priced["summary"]["discount_total"]
    total_price = priced["summary"]["total"] + delivery_fee

    # One transaction: order + items + payment all-or-nothing.
    order = Order(
        order_no=_generate_order_no(db),
        customer_id=user.id,
        delivery_location_id=location.id,
        delivery_window_start=body.delivery_window_start,
        delivery_window_end=body.delivery_window_end,
        status="READY_FOR_DISPATCH",
        subtotal=subtotal,
        discount_total=discount_total,
        delivery_fee=delivery_fee,
        total_price=total_price,
        idempotency_key=idempotency_key,
    )
    db.add(order)
    db.flush()

    for item in priced["items"]:
        order_item = OrderItem(
            order_id=order.id,
            product_id=item["product_id"],
            quantity=item["quantity"],
            selected_unit=item["selected_unit"],
            unit_multiplier=item["unit_multiplier"],
            base_price_at_time=item["base_price_at_time"],
            discount_amount_at_time=item["discount_amount_at_time"],
            price_at_time=item["line_total"],
        )
        db.add(order_item)

    payment = Payment(
        order_id=order.id,
        method=body.payment_method,
        amount=total_price,
        status="pending",
    )
    db.add(payment)
    db.flush()

    order.payment_id = payment.id

    # Confirmation email + notification log row — failure inside
    # notify_order_status is captured on the row, never raised.
    notify_order_status(db, order, order.status)

    db.commit()
    db.refresh(order)

    return _order_out(db, order)


@router.get("", response_model=dict)
def list_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    query = db.query(Order)
    if _is_customer(user):
        query = query.filter(Order.customer_id == user.id)
    if status_filter:
        query = query.filter(Order.status == status_filter.upper())
    query = query.order_by(Order.created_at.desc())

    total_items = query.count()
    total_pages = max(1, math.ceil(total_items / page_size))
    orders = query.offset((page - 1) * page_size).limit(page_size).all()

    data = []
    for order in orders:
        data.append(OrderOut.model_validate(order).model_dump())

    return {
        "data": data,
        "pagination": Pagination(
            page=page,
            page_size=page_size,
            total_items=total_items,
            total_pages=total_pages,
        ).model_dump(),
    }


@router.get("/{order_no}", response_model=OrderOut)
def get_order(
    order_no: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    order = _get_order_or_404(db, order_no)
    _check_can_see(order, user)
    return _order_out(db, order)


@router.get("/{order_no}/status", response_model=OrderStatusOut)
def get_order_status(
    order_no: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    order = _get_order_or_404(db, order_no)
    _check_can_see(order, user)

    delivery = db.query(Delivery).filter(Delivery.order_id == order.id).first()
    history = []
    if delivery:
        events = db.query(DeliveryStatus).filter(
            DeliveryStatus.delivery_id == delivery.id
        ).order_by(DeliveryStatus.created_at.asc()).all()
        for event in events:
            history.append(StatusEventOut.model_validate(event))

    return OrderStatusOut(
        order_no=order.order_no,
        status=order.status,
        delivery_id=delivery.id if delivery else None,
        delivery_status=delivery.status if delivery else None,
        cancellation_reason=order.cancellation_reason,
        history=history,
    )


@router.post("/{order_no}/cancel", response_model=OrderOut)
def cancel_order(
    order_no: str,
    body: CancelRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    order = _get_order_or_404(db, order_no)
    _check_can_see(order, user)

    if order.status == "CANCELLED":
        raise api_error(409, "CONFLICT", "Order is already cancelled.")
    if order.status not in CANCELLABLE_STATUSES:
        raise api_error(
            409, "CONFLICT",
            f"Order can no longer be cancelled (status: {order.status}).",
        )

    order.status = "CANCELLED"
    order.cancellation_reason = body.reason

    notify_order_status(db, order, "CANCELLED", note=body.reason)

    db.commit()
    db.refresh(order)
    return _order_out(db, order)
