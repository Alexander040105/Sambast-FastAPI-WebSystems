from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import require_role
from app.models.route import Route
from app.models.delivery import Delivery
from app.models.delivery_stop import DeliveryStop
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.location import Location
from app.models.driver import Driver
from app.models.driver_shift import DriverShift
from app.models.vehicle import Vehicle
from app.models.user import User
from app.models.proof_of_delivery import ProofOfDelivery
from app.schemas.route import RouteCreateRequest, RouteReorderRequest, RouteDetailResponse, StopResponse, RouteAvailableItem
from typing import List
from datetime import datetime, timezone
from app.services.routing import optimize_route

router = APIRouter(prefix="/routes", tags=["Routes"])

def get_stop_response(db: Session, stop: DeliveryStop) -> StopResponse:
    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    order = db.query(Order).filter(Order.id == delivery.order_id).first() if delivery else None
    loc = db.query(Location).filter(Location.id == stop.location_id).first() if stop.location_id else None
    
    address = f"{loc.line1}, {loc.city}" if loc else "Unknown address"
    if loc and loc.province:
        address = f"{loc.line1}, {loc.city}, {loc.province}"
    destination = loc.label or loc.city if loc else "Destination"

    window = "Not provided"
    if order and order.delivery_window_start and order.delivery_window_end:
        window = f"{order.delivery_window_start.strftime('%H:%M')} - {order.delivery_window_end.strftime('%H:%M')}"

    # Query real ProofOfDelivery if present
    pod = db.query(ProofOfDelivery).filter(ProofOfDelivery.delivery_id == delivery.id).order_by(ProofOfDelivery.id.desc()).first() if delivery else None

    # Compute weight
    weight_str = "1.0 kg"
    if order:
        items = db.query(OrderItem, Product).outerjoin(Product, OrderItem.product_id == Product.id).filter(OrderItem.order_id == order.id).all()
        total_w = sum(float(p.weight_kg_per_unit or 0.0) * float(it.quantity or 1.0) * float(it.unit_multiplier or 1.0) for it, p in items if p)
        if total_w > 0:
            weight_str = f"{total_w:.1f} kg"

    # Recipient
    recipient = "Customer"
    if order and order.customer_id:
        cust = db.query(User).filter(User.id == order.customer_id).first()
        if cust:
            recipient = cust.name or cust.email.split("@")[0]

    return StopResponse(
        id=stop.id,
        delivery_id=stop.delivery_id,
        sequence=stop.sequence_no,
        destination=destination,
        address=address,
        delivery_window=window,
        status=stop.status.lower() if stop.status else "pending",
        weight=weight_str,
        order_no=order.order_no if order else "UNKNOWN",
        recipient=recipient,
        failure_reason=delivery.failure_reason if delivery else None,
        failure_notes=None,
        pod_photo_name=pod.file_url if pod else None,
        recipient_name=pod.recipient_name if pod else None,
        delivered_at=stop.departed_at.strftime("%H:%M") if stop.departed_at else None
    )

@router.post("", status_code=status.HTTP_201_CREATED)
def build_route(
    req: RouteCreateRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin")),
):
    # Find deliveries assigned to driver but not yet on a route
    deliveries = db.query(Delivery).filter(
        Delivery.driver_id == req.driver_id,
        Delivery.route_id == None,
        Delivery.status == "PENDING"
    ).all()

    if not deliveries:
        raise HTTPException(status_code=400, detail="No pending deliveries for this driver.")

    # Auto-populate shift_id and vehicle_id from driver's active shift if omitted
    shift_id = req.shift_id
    vehicle_id = req.vehicle_id
    if not shift_id or not vehicle_id:
        now = datetime.now(timezone.utc)
        active_shift = (
            db.query(DriverShift)
            .filter(
                DriverShift.driver_id == req.driver_id,
                DriverShift.starts_at <= now,
                DriverShift.ends_at >= now,
            )
            .first()
        )
        if not active_shift:
            active_shift = (
                db.query(DriverShift)
                .filter(DriverShift.driver_id == req.driver_id)
                .order_by(DriverShift.id.desc())
                .first()
            )
        if active_shift:
            if not shift_id:
                shift_id = active_shift.id
            if not vehicle_id:
                vehicle_id = active_shift.vehicle_id

    # Create the route
    route = Route(
        driver_id=req.driver_id,
        vehicle_id=vehicle_id,
        shift_id=shift_id,
        date=datetime.now(timezone.utc).date(),
        status="planned"
    )
    db.add(route)
    db.flush()

    # Create stops
    for idx, d in enumerate(deliveries):
        d.route_id = route.id
        order = db.query(Order).filter(Order.id == d.order_id).first()
        loc_id = order.delivery_location_id if order else None
        
        stop = DeliveryStop(
            route_id=route.id,
            delivery_id=d.id,
            location_id=loc_id,
            sequence_no=idx + 1
        )
        db.add(stop)
    
    db.commit()
    db.refresh(route)

    from app.services.routing import recompute_route_metrics
    recompute_route_metrics(db, route.id)

    from app.services.costing import calculate_route_cost
    calculate_route_cost(db, route.id)

    return {"id": route.id, "message": f"Route created with {len(deliveries)} stops."}

@router.get("", response_model=List[RouteAvailableItem])
def get_routes(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin", "ops_manager", "driver")),
):
    routes = db.query(Route).all()
    return [{"id": str(r.id), "status": r.status} for r in routes]

@router.get("/{id}", response_model=RouteDetailResponse)
def get_route_detail(
    id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin", "ops_manager", "driver")),
):
    route = db.query(Route).filter(Route.id == id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    driver = db.query(Driver).filter(Driver.id == route.driver_id).first()
    vehicle = db.query(Vehicle).filter(Vehicle.id == route.vehicle_id).first() if route.vehicle_id else None
    stops = db.query(DeliveryStop).filter(DeliveryStop.route_id == route.id).order_by(DeliveryStop.sequence_no).all()
    
    stop_responses = [get_stop_response(db, s) for s in stops]
    
    driver_label = "Unknown"
    if driver:
        driver_label = driver.license_no if driver.license_no else f"Driver #{driver.id}"

    vehicle_label = vehicle.plate_no if vehicle else (str(route.vehicle_id) if route.vehicle_id else "Unknown")
    
    return {
        "id": str(route.id),
        "status": route.status,
        "assigned_driver": driver_label,
        "vehicle": vehicle_label,
        "estimated_remaining_min": int(route.est_duration_min or 0),
        "stops": stop_responses
    }

@router.post("/{id}/optimize")
def optimize_route_api(
    id: int,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin")),
):
    route = db.query(Route).filter(Route.id == id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    optimize_route(db, id)
    from app.services.costing import calculate_route_cost
    calculate_route_cost(db, id)
    return {"message": "Route optimized"}

@router.patch("/{id}")
def reorder_route(
    id: int,
    req: RouteReorderRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("dispatcher", "admin")),
):
    route = db.query(Route).filter(Route.id == id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    for s in req.stops:
        stop = db.query(DeliveryStop).filter(DeliveryStop.id == s.id, DeliveryStop.route_id == id).first()
        if stop:
            stop.sequence_no = s.sequence_no
            
    db.commit()
    from app.services.routing import recompute_route_metrics
    recompute_route_metrics(db, id)
    from app.services.costing import calculate_route_cost
    calculate_route_cost(db, id)
    return {"message": "Route stops reordered"}
