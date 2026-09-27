import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from app.db.session import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.models.route import Route
from app.models.delivery import Delivery
from app.models.delivery_stop import DeliveryStop
from app.models.order import Order
from app.models.driver import Driver
from app.models.driver_shift import DriverShift
from app.models.proof_of_delivery import ProofOfDelivery
from app.models.delivery_status_event import DeliveryStatusEvent
from app.schemas.route import DriverManifestResponse, StopFailRequest
from app.routers.routes import get_stop_response
from app.services.sse import broadcaster

router = APIRouter(tags=["Driver Workflow"])


def record_event(
    db: Session,
    delivery_id: int,
    status_str: str,
    user_id: int,
    note: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
):
    event = DeliveryStatusEvent(
        delivery_id=delivery_id,
        status=status_str,
        note=note,
        lat=lat,
        lng=lng,
        actor_user_id=user_id,
    )
    db.add(event)

    # Resolve order_no for SSE broadcast
    delivery = db.query(Delivery).filter(Delivery.id == delivery_id).first()
    order_no = ""
    if delivery:
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order:
            order_no = order.order_no

    # Emit real-time SSE event
    broadcaster.emit(
        delivery_id=delivery_id,
        order_no=order_no,
        status=status_str,
        lat=lat,
        lng=lng,
        note=note,
    )


def check_and_complete_route(db: Session, route_id: int):
    """If all stops on the route are DELIVERED or FAILED, mark route completed."""
    if not route_id:
        return
    active_stops = db.query(DeliveryStop).filter(
        DeliveryStop.route_id == route_id,
        DeliveryStop.status.in_(["PENDING", "EN_ROUTE", "ARRIVED", "pending", "en_route", "arrived"]),
    ).count()
    if active_stops == 0:
        route = db.query(Route).filter(Route.id == route_id).first()
        if route and route.status != "completed":
            route.status = "completed"
            db.commit()


@router.get("/me/route", response_model=DriverManifestResponse)
def get_my_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Lookup driver profile for the current user
    driver = db.query(Driver).filter(Driver.user_id == current_user.id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")

    route = db.query(Route).filter(
        Route.driver_id == driver.id,
        Route.status.in_(["planned", "active"]),
    ).order_by(Route.id.desc()).first()

    stops = []
    route_started = False

    if route:
        if route.status == "active":
            route_started = True

        stop_records = db.query(DeliveryStop).filter(
            DeliveryStop.route_id == route.id
        ).order_by(DeliveryStop.sequence_no).all()
        stops = [get_stop_response(db, s) for s in stop_records]

    # Resolve active shift label
    now = datetime.now(timezone.utc)
    shift = db.query(DriverShift).filter(
        DriverShift.driver_id == driver.id,
        DriverShift.starts_at <= now,
        DriverShift.ends_at >= now,
    ).first()
    shift_label = (
        f"Shift: {shift.starts_at.strftime('%H:%M')}–{shift.ends_at.strftime('%H:%M')}"
        if shift
        else "Active Shift"
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


@router.post("/stops/{id}/start")
def start_stop(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stop = db.query(DeliveryStop).filter(DeliveryStop.id == id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")

    stop.status = "EN_ROUTE"

    # Also mark delivery
    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    if delivery:
        delivery.status = "EN_ROUTE"
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order:
            order.status = "OUT_FOR_DELIVERY"
        record_event(db, delivery.id, "EN_ROUTE", current_user.id)

    # Mark route active
    route = db.query(Route).filter(Route.id == stop.route_id).first()
    if route and route.status == "planned":
        route.status = "active"

    db.commit()
    return get_my_route(db, current_user)


@router.post("/stops/{id}/arrive")
def arrive_stop(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stop = db.query(DeliveryStop).filter(DeliveryStop.id == id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")

    stop.status = "ARRIVED"
    stop.arrived_at = datetime.now(timezone.utc)

    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    if delivery:
        delivery.status = "ARRIVED"
        record_event(db, delivery.id, "ARRIVED", current_user.id)

    db.commit()
    return get_my_route(db, current_user)


@router.post("/deliveries/{id}/pod")
async def upload_pod(
    id: int,
    request: Request,
    photo: Optional[UploadFile] = File(None),
    recipient_name: Optional[str] = Form(None),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Resolve delivery: id may be delivery_id or stop_id (frontend flexibility)
    delivery = db.query(Delivery).filter(Delivery.id == id).first()
    if not delivery:
        stop = db.query(DeliveryStop).filter(DeliveryStop.id == id).first()
        if stop:
            delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()

    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery or stop not found")

    content_type = request.headers.get("content-type", "")
    web_path = "/uploads/default_pod.jpg"
    notes = None

    if "application/json" in content_type:
        try:
            body = await request.json()
            recipient_name = body.get("recipient_name") or recipient_name
            lat = body.get("lat") or lat
            lng = body.get("lng") or lng
            notes = body.get("notes")
            web_path = body.get("photo_url") or body.get("signature_url") or web_path
        except Exception:
            pass
    elif photo:
        uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "uploads"))
        os.makedirs(uploads_dir, exist_ok=True)
        file_ext = os.path.splitext(photo.filename or "")[1] or ".jpg"
        unique_filename = f"pod_{delivery.id}_{uuid.uuid4().hex[:8]}{file_ext}"
        abs_path = os.path.join(uploads_dir, unique_filename)
        with open(abs_path, "wb") as buffer:
            buffer.write(await photo.read())
        web_path = f"/uploads/{unique_filename}"

    pod = ProofOfDelivery(
        delivery_id=delivery.id,
        type="photo",
        file_url=web_path,
        recipient_name=recipient_name,
        lat=lat,
        lng=lng,
        captured_at=datetime.now(timezone.utc),
    )
    db.add(pod)

    record_event(
        db,
        delivery.id,
        "POD_CAPTURED",
        current_user.id,
        note=f"POD uploaded: {web_path}. {f'Notes: {notes}' if notes else ''}".strip(),
        lat=lat,
        lng=lng,
    )
    db.commit()

    return {"message": "POD saved successfully", "file_url": web_path, "pod_id": pod.id}


@router.post("/stops/{id}/complete")
def complete_stop(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stop = db.query(DeliveryStop).filter(DeliveryStop.id == id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")

    stop.status = "DELIVERED"
    stop.departed_at = datetime.now(timezone.utc)

    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    if delivery:
        delivery.status = "DELIVERED"
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order:
            order.status = "COMPLETED"
        record_event(db, delivery.id, "DELIVERED", current_user.id)

    db.commit()

    # If all stops on route are done, complete route
    check_and_complete_route(db, stop.route_id)

    return get_my_route(db, current_user)


@router.post("/stops/{id}/fail")
def fail_stop(
    id: int,
    payload: StopFailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stop = db.query(DeliveryStop).filter(DeliveryStop.id == id).first()
    if not stop:
        raise HTTPException(status_code=404, detail="Stop not found")

    stop.status = "FAILED"
    stop.departed_at = datetime.now(timezone.utc)

    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    if delivery:
        delivery.status = "FAILED"
        delivery.failure_reason = payload.reason
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order:
            order.status = "READY_FOR_DISPATCH"  # re-queue to dispatch

        record_event(
            db,
            delivery.id,
            "FAILED",
            current_user.id,
            note=f"Reason: {payload.reason}. Notes: {payload.notes or ''}",
        )

    db.commit()

    # If all stops on route are done, complete route
    check_and_complete_route(db, stop.route_id)

    return get_my_route(db, current_user)
