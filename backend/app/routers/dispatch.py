"""
/api/v1/dispatch — dispatch queue, manual assign, auto-assign.
Dispatcher + Admin only.
"""

from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.db.session import get_db
from app.models.order import Order
from app.models.location import Location
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.driver import Driver
from app.models.delivery import Delivery
from app.models.delivery_status_event import DeliveryStatusEvent
from app.models.user import User

from app.schemas.dispatch import (
    DispatchQueueResponse,
    DispatchQueueOrderOut,
    ManualAssignRequest,
    AutoAssignRequest,
    AutoAssignResponse,
)
from app.schemas.fleet import LocationOut
from app.services.assignment import get_auto_assign_suggestion

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

    return DispatchQueueResponse(data=out_list)


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
        
    if order.status not in ["READY_FOR_DISPATCH", "PENDING"]:
        raise HTTPException(status_code=400, detail=f"Order is not available for assignment (status: {order.status})")

    driver = db.query(Driver).filter(Driver.id == body.driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    # Update Order
    order.status = "ASSIGNED"
    
    # Create Delivery
    delivery = Delivery(
        order_id=order.id,
        driver_id=driver.id,
        status="PENDING",
        assigned_at=datetime.now(timezone.utc),
    )
    db.add(delivery)
    db.commit()
    db.refresh(delivery)
    
    # Create DeliveryStatusEvent
    event = DeliveryStatusEvent(
        delivery_id=delivery.id,
        status="ASSIGNED",
        note="Manually assigned",
        actor_user_id=_user.id
    )
    db.add(event)
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
