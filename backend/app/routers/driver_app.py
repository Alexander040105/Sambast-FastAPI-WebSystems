import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone

from app.db.session import get_db
from app.core.deps import get_current_user, require_role
from app.models.user import User
from app.models.route import Route
from app.models.delivery import Delivery
from app.models.delivery_stop import DeliveryStop
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.products import Product
from app.models.driver import Driver
from app.models.driver_shift import DriverShift
from app.models.proof_of_delivery import ProofOfDelivery
from app.models.delivery_status import DeliveryStatus
from app.schemas.route import DriverManifestResponse, StopFailRequest
from app.routers.routes import build_stop_responses
from app.services.notifications import notify_order_status
from app.services.routing import recompute_route_metrics
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
    event = DeliveryStatus(
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

    # Fallback to completed route for today so driver can view finished manifest
    if not route:
        today_date = datetime.now(timezone.utc).date()
        route = db.query(Route).filter(
            Route.driver_id == driver.id,
            Route.status == "completed",
            Route.date == today_date,
        ).order_by(Route.id.desc()).first()

    # Auto-reconcile: attach any pending deliveries assigned to this driver that lack a route
    unrouted = (
        db.query(Delivery)
        .filter(
            Delivery.driver_id == driver.id,
            Delivery.route_id == None,
            Delivery.status == "PENDING",
        )
        .all()
    )
    if unrouted:
        if not route:
            shift_rec = (
                db.query(DriverShift)
                .filter(DriverShift.driver_id == driver.id)
                .order_by(DriverShift.id.desc())
                .first()
            )
            route = Route(
                driver_id=driver.id,
                vehicle_id=shift_rec.vehicle_id if shift_rec else None,
                shift_id=shift_rec.id if shift_rec else None,
                date=datetime.now(timezone.utc).date(),
                status="active",
            )
            db.add(route)
            db.flush()

        max_seq = (
            db.query(func.max(DeliveryStop.sequence_no))
            .filter(DeliveryStop.route_id == route.id)
            .scalar()
            or 0
        )
        for idx, ud in enumerate(unrouted):
            ud.route_id = route.id
            ord_row = db.query(Order).filter(Order.id == ud.order_id).first()
            loc_id = ord_row.delivery_location_id if ord_row else None
            new_stop = DeliveryStop(
                route_id=route.id,
                delivery_id=ud.id,
                location_id=loc_id,
                sequence_no=max_seq + idx + 1,
                status="PENDING",
            )
            db.add(new_stop)
        db.commit()
        recompute_route_metrics(db, route.id)

    stops = []
    route_started = False

    if route:
        if route.status in ["active", "completed"]:
            route_started = True

        stop_records = db.query(DeliveryStop).filter(
            DeliveryStop.route_id == route.id
        ).order_by(DeliveryStop.sequence_no).all()
        stops = build_stop_responses(db, stop_records)

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


from app.models.payment import Payment


def check_stop_permission(db: Session, stop: DeliveryStop, user: User) -> None:
    """Enforce horizontal authorization for driver stop actions."""
    if user.role in ["dispatcher", "admin", "ops_manager"]:
        return
    driver = db.query(Driver).filter(Driver.user_id == user.id).first()
    if not driver:
        raise HTTPException(status_code=403, detail="Driver profile not found")
    route = db.query(Route).filter(Route.id == stop.route_id).first()
    if not route or route.driver_id != driver.id:
        raise HTTPException(
            status_code=403,
            detail="You are not authorized to update stops on this route",
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

    check_stop_permission(db, stop, current_user)

    if stop.status and stop.status.upper() in ["DELIVERED", "FAILED"]:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot start a stop that is already {stop.status.upper()}",
        )

    stop.status = "EN_ROUTE"

    # Also mark delivery
    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    if delivery:
        delivery.status = "EN_ROUTE"
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order:
            order.status = "OUT_FOR_DELIVERY"
            notify_order_status(db, order, "OUT_FOR_DELIVERY")
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

    check_stop_permission(db, stop, current_user)

    if stop.status and stop.status.upper() in ["DELIVERED", "FAILED"]:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot arrive at a stop that is already {stop.status.upper()}",
        )

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
    # Disambiguate delivery: check if caller is driver and id is on driver's active route
    driver = db.query(Driver).filter(Driver.user_id == current_user.id).first()
    delivery = None

    if driver and current_user.role == "driver":
        # First check if id is a DeliveryStop belonging to driver's route
        stop = (
            db.query(DeliveryStop)
            .join(Route, DeliveryStop.route_id == Route.id)
            .filter(DeliveryStop.id == id, Route.driver_id == driver.id)
            .first()
        )
        if stop:
            delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
        else:
            # Check if id is a Delivery belonging to driver
            delivery = db.query(Delivery).filter(Delivery.id == id, Delivery.driver_id == driver.id).first()

    if not delivery:
        # Fallback for dispatchers/admins or direct lookup
        delivery = db.query(Delivery).filter(Delivery.id == id).first()
        if not delivery:
            stop = db.query(DeliveryStop).filter(DeliveryStop.id == id).first()
            if stop:
                delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()

    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery or stop not found")

    if current_user.role == "driver" and driver:
        if delivery.driver_id != driver.id:
            raise HTTPException(status_code=403, detail="You are not authorized to upload POD for this delivery")

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

    check_stop_permission(db, stop, current_user)

    if stop.status and stop.status.upper() == "DELIVERED":
        raise HTTPException(
            status_code=409,
            detail="Stop is already completed (DELIVERED)",
        )
    if stop.status and stop.status.upper() == "FAILED":
        raise HTTPException(
            status_code=409,
            detail="Cannot complete a stop that has already FAILED",
        )

    stop.status = "DELIVERED"
    stop.departed_at = datetime.now(timezone.utc)

    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    if delivery:
        delivery.status = "DELIVERED"
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order:
            order.status = "COMPLETED"
            # Deduct stock once, on transition to COMPLETED, using quantity × unit_multiplier (MEGAPLAN §8)
            order_items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
            for item in order_items:
                product = db.query(Product).filter(Product.id == item.product_id).first()
                if product:
                    deduct_qty = int(float(item.quantity or 1.0) * float(item.unit_multiplier or 1.0))
                    current_qty = product.stock_quantity if product.stock_quantity is not None else 0
                    product.stock_quantity = max(0, current_qty - deduct_qty)

            # Reconcile COD payment to paid on delivery completion (MEGAPLAN §6 & §8)
            payment = db.query(Payment).filter(Payment.order_id == order.id).first()
            if payment and payment.status.lower() in ["pending", "unpaid"]:
                payment.status = "paid"
                payment.paid_at = datetime.now(timezone.utc)
                payment.amount = order.total_price

            notify_order_status(db, order, "DELIVERED")

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

    check_stop_permission(db, stop, current_user)

    if stop.status and stop.status.upper() in ["DELIVERED", "FAILED"]:
        raise HTTPException(
            status_code=409,
            detail=f"Stop has already been marked as {stop.status.upper()}",
        )

    stop.status = "FAILED"
    stop.departed_at = datetime.now(timezone.utc)

    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    if delivery:
        delivery.failure_reason = payload.reason
        order = db.query(Order).filter(Order.id == delivery.order_id).first()

        # Terminal RETURNED check per MEGAPLAN §5.7 & §7.2
        is_terminal = (delivery.attempt_no >= 3) or (payload.reason == "delivery_declined")
        if is_terminal:
            delivery.status = "RETURNED"
            if order:
                order.status = "RETURNED"
                notify_order_status(
                    db, order, "RETURNED", note=payload.reason
                )
            record_event(
                db,
                delivery.id,
                "RETURNED",
                current_user.id,
                note=f"Terminal return after attempt #{delivery.attempt_no}. Reason: {payload.reason}. Notes: {payload.notes or ''}",
            )
        else:
            delivery.status = "FAILED"
            if order:
                order.status = "READY_FOR_DISPATCH"  # re-queue to dispatch
                notify_order_status(
                    db, order, "FAILED", note=payload.reason
                )
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
