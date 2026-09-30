"""
/api/v1/dispatch — dispatch queue, manual assign, auto-assign.
Dispatcher + Admin only.
"""

from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.deps import require_role
from app.db.session import get_db
from app.models.order import Order
from app.models.location import Location
from app.models.order_item import OrderItem
from app.models.products import Product
from app.models.driver import Driver
from app.models.delivery import Delivery
from app.models.delivery_status import DeliveryStatus
from app.models.route import Route
from app.models.delivery_stop import DeliveryStop
from app.models.driver_shift import DriverShift
from app.models.user import User
from app.services.routing import recompute_route_metrics

from app.schemas.dispatch import (
    DispatchQueueResponse,
    DispatchQueueOrderOut,
    ManualAssignRequest,
    AutoAssignRequest,
    AutoAssignResponse,
)
from app.schemas.fleet import LocationOut, Pagination
from app.services.assignment import get_auto_assign_suggestion
from app.services.notifications import notify_order_status
from app.services.sse import broadcaster

router = APIRouter(prefix="/dispatch", tags=["dispatch"])


@router.get("/queue", response_model=DispatchQueueResponse)
def get_dispatch_queue(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin")),
):
    orders = db.query(Order).filter(Order.status == "READY_FOR_DISPATCH").all()
    if not orders:
        return DispatchQueueResponse(data=[])

    # 1. Batch fetch locations
    loc_ids = {o.delivery_location_id for o in orders if o.delivery_location_id}
    loc_map = {}
    if loc_ids:
        locs = db.query(Location).filter(Location.id.in_(loc_ids)).all()
        loc_map = {loc.id: LocationOut.model_validate(loc) for loc in locs}

    # 2. Batch fetch order items & product weights
    order_ids = [o.id for o in orders]
    items = (
        db.query(OrderItem, Product)
        .outerjoin(Product, OrderItem.product_id == Product.id)
        .filter(OrderItem.order_id.in_(order_ids))
        .all()
    )

    weights = {}
    for item, product in items:
        kg_per_unit = float(product.weight_kg_per_unit) if product and product.weight_kg_per_unit else 0.0
        w = kg_per_unit * float(item.quantity or 1.0) * float(item.unit_multiplier or 1.0)
        weights[item.order_id] = weights.get(item.order_id, 0.0) + w

    out_list = [
        DispatchQueueOrderOut(
            id=o.id,
            order_no=o.order_no,
            delivery_window_start=o.delivery_window_start,
            delivery_window_end=o.delivery_window_end,
            delivery_location=loc_map.get(o.delivery_location_id),
            total_weight_kg=round(weights.get(o.id, 0.0), 2),
        )
        for o in orders
    ]

    return DispatchQueueResponse(
        data=out_list,
        pagination=Pagination(
            page=1,
            page_size=len(out_list) or 50,
            total_items=len(out_list),
            total_pages=1,
        ),
    )


@router.post("/orders/{order_id}/assign", status_code=status.HTTP_200_OK)
def manual_assign(
    order_id: int,
    body: ManualAssignRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin")),
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.status == "ASSIGNED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Order {order_id} is already assigned to a driver",
        )
    if order.status not in ["READY_FOR_DISPATCH", "PENDING"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order is not available for assignment (status: {order.status})",
        )

    # Check for active existing delivery
    active_delivery = (
        db.query(Delivery)
        .filter(
            Delivery.order_id == order.id,
            Delivery.status.in_(["PENDING", "EN_ROUTE", "ARRIVED"]),
        )
        .first()
    )
    if active_delivery:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Order {order_id} already has an active delivery (ID: {active_delivery.id})",
        )

    driver = db.query(Driver).filter(Driver.id == body.driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    # Update Order
    order.status = "ASSIGNED"
    
    # Calculate attempt_no if this order had previous delivery attempts
    past_deliveries = db.query(Delivery).filter(Delivery.order_id == order.id).all()
    attempt_no = len(past_deliveries) + 1 if past_deliveries else 1

    # Look up or create driver's active/planned route for today
    route = (
        db.query(Route)
        .filter(
            Route.driver_id == driver.id,
            Route.status.in_(["planned", "active"]),
        )
        .order_by(Route.id.desc())
        .first()
    )
    if not route:
        shift = (
            db.query(DriverShift)
            .filter(DriverShift.driver_id == driver.id)
            .order_by(DriverShift.id.desc())
            .first()
        )
        route = Route(
            driver_id=driver.id,
            vehicle_id=shift.vehicle_id if shift else None,
            shift_id=shift.id if shift else None,
            date=datetime.now(timezone.utc).date(),
            status="active",
        )
        db.add(route)
        db.flush()

    # Create Delivery attached to route
    delivery = Delivery(
        order_id=order.id,
        driver_id=driver.id,
        route_id=route.id,
        status="PENDING",
        attempt_no=attempt_no,
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(delivery)
    db.flush()

    # Create DeliveryStop on the route
    max_seq = (
        db.query(func.max(DeliveryStop.sequence_no))
        .filter(DeliveryStop.route_id == route.id)
        .scalar()
        or 0
    )
    stop = DeliveryStop(
        route_id=route.id,
        delivery_id=delivery.id,
        location_id=order.delivery_location_id,
        sequence_no=max_seq + 1,
        status="PENDING",
    )
    db.add(stop)
    db.commit()
    db.refresh(delivery)

    # Recompute route metrics (distance, duration, planned ETAs)
    recompute_route_metrics(db, route.id)
    
    # Create DeliveryStatus event row
    event = DeliveryStatus(
        delivery_id=delivery.id,
        status="ASSIGNED",
        note=f"Manually assigned to driver #{driver.id} (Attempt #{attempt_no})",
        actor_user_id=_user.id
    )
    db.add(event)
    db.commit()

    # Emit real-time SSE event for tracking and fleet streams (MEGAPLAN §5.9, §7.2)
    lat, lng = None, None
    if order.delivery_location_id:
        loc = db.query(Location).filter(Location.id == order.delivery_location_id).first()
        if loc and loc.lat and loc.lng:
            lat = float(loc.lat)
            lng = float(loc.lng)

    broadcaster.emit(
        delivery_id=delivery.id,
        order_no=order.order_no,
        status="ASSIGNED",
        lat=lat,
        lng=lng,
        note=f"Assigned to driver #{driver.id}",
    )

    # Customer email + notification log (MEGAPLAN §5.10). Failure is
    # captured on the notification row, never raised.
    notify_order_status(db, order, "ASSIGNED", note=f"Assigned to driver #{driver.id}")
    db.commit()

    return {"status": "success", "delivery_id": delivery.id, "order_status": order.status}



@router.post("/auto-assign", response_model=AutoAssignResponse)
def auto_assign(
    body: AutoAssignRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin")),
):
    suggestion = get_auto_assign_suggestion(body.order_id, db)
    return AutoAssignResponse(
        driver_id=suggestion["driver_id"],
        vehicle_id=suggestion["vehicle_id"],
        reason=suggestion["reason"]
    )
