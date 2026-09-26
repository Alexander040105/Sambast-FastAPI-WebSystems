"""
/api/v1/track — public order tracking + SSE streams (BE-A T7).

GET /track/{order_no}        public JSON snapshot (order + status history)
GET /track/{order_no}/stream SSE — the logged-in owner (or staff) watches
                             one order's delivery_statuses live
GET /fleet/stream            SSE — staff watch every delivery event

sse-starlette isn't installed, so streams are plain StreamingResponse
generators. Each polls the DB every 2s and emits new rows in the §7.2
shape:  event: status / data: {delivery_id, order_no, status, at}
"""

import json
import time

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.db.session import SessionLocal, get_db
from app.models.delivery import Delivery
from app.models.delivery_status import DeliveryStatus
from app.models.order import Order
from app.models.user import User

router = APIRouter(tags=["tracking"])

POLL_SECONDS = 2
MAX_EVENTS = 300  # ~10 minutes of stream, then the client reconnects


def _order_for_tracking(db: Session, order_no: str) -> Order:
    order = db.query(Order).filter(Order.order_no == order_no).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


def _history_for(db: Session, order: Order) -> list:
    """delivery_statuses rows for the order's delivery, oldest first."""
    delivery = db.query(Delivery).filter(Delivery.order_id == order.id).first()
    if not delivery:
        return delivery, []
    events = db.query(DeliveryStatus).filter(
        DeliveryStatus.delivery_id == delivery.id
    ).order_by(DeliveryStatus.created_at.asc()).all()
    return delivery, events


@router.get("/track/{order_no}")
def track_order(order_no: str, db: Session = Depends(get_db)):
    """Public — anyone holding the order number can see where it is."""
    order = _order_for_tracking(db, order_no)
    delivery, events = _history_for(db, order)

    history = []
    for event in events:
        history.append({
            "status": event.status,
            "note": event.note,
            "lat": float(event.lat) if event.lat is not None else None,
            "lng": float(event.lng) if event.lng is not None else None,
            "at": event.created_at.isoformat() if event.created_at else None,
        })

    return {
        "order_no": order.order_no,
        "status": order.status,
        "delivery_status": delivery.status if delivery else None,
        "history": history,
    }


def _sse(payload: dict) -> str:
    """One SSE frame in the §7.2 shape."""
    return f"event: status\ndata: {json.dumps(payload)}\n\n"


def _payload(event: DeliveryStatus, order: Order) -> dict:
    return {
        "delivery_id": event.delivery_id,
        "order_no": order.order_no,
        "status": event.status,
        "at": event.created_at.isoformat() if event.created_at else None,
    }


def _order_stream(order_id: int):
    """Yield every delivery_statuses row for the order, then poll for new
    ones. Opens its own session — the request-scoped get_db session must not
    outlive the handler."""
    with SessionLocal() as db:
        delivery = db.query(Delivery).filter(Delivery.order_id == order_id).first()
        if not delivery:
            return
        order = db.query(Order).filter(Order.id == order_id).first()

        watermark = 0
        sent = 0
        while sent < MAX_EVENTS:
            events = db.query(DeliveryStatus).filter(
                DeliveryStatus.delivery_id == delivery.id,
                DeliveryStatus.id > watermark,
            ).order_by(DeliveryStatus.id.asc()).all()

            for event in events:
                watermark = event.id
                sent += 1
                yield _sse(_payload(event, order))

            db.commit()  # release the read transaction before sleeping
            time.sleep(POLL_SECONDS)


@router.get("/track/{order_no}/stream")
def stream_order(
    order_no: str,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    order = _order_for_tracking(db, order_no)
    if getattr(user, "role", None) == "customer" and order.customer_id != user.id:
        raise HTTPException(status_code=404, detail="Order not found")

    return StreamingResponse(
        _order_stream(order.id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _fleet_stream():
    """Staff view — every new delivery_statuses row system-wide."""
    with SessionLocal() as db:
        latest_id = db.query(DeliveryStatus.id).order_by(
            DeliveryStatus.id.desc()
        ).first()
        watermark = latest_id[0] if latest_id else 0

        sent = 0
        while sent < MAX_EVENTS:
            events = db.query(DeliveryStatus).filter(
                DeliveryStatus.id > watermark
            ).order_by(DeliveryStatus.id.asc()).all()

            for event in events:
                watermark = event.id
                sent += 1
                delivery = db.query(Delivery).filter(
                    Delivery.id == event.delivery_id
                ).first()
                order = (
                    db.query(Order).filter(Order.id == delivery.order_id).first()
                    if delivery else None
                )
                if order:
                    yield _sse(_payload(event, order))

            db.commit()
            time.sleep(POLL_SECONDS)


@router.get("/fleet/stream")
def stream_fleet(
    user: User = Depends(require_role("admin", "dispatcher", "ops_manager")),
):
    return StreamingResponse(
        _fleet_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
