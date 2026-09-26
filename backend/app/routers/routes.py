from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import require_role
from app.models.route import Route
from app.models.delivery import Delivery
from app.models.delivery_stop import DeliveryStop
from app.models.order import Order
from app.models.location import Location
from app.models.driver import Driver
from app.schemas.route import RouteCreateRequest, RouteReorderRequest, RouteDetailResponse, StopResponse, RouteAvailableItem
from typing import List
from datetime import datetime, timezone
from app.services.routing import optimize_route

router = APIRouter(prefix="/routes", tags=["Routes"])

def get_stop_response(db: Session, stop: DeliveryStop) -> StopResponse:
    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    order = db.query(Order).filter(Order.id == delivery.order_id).first() if delivery else None
    loc = db.query(Location).filter(Location.id == stop.location_id).first() if stop.location_id else None
    
    address = f"{loc.line1} {loc.city}, {loc.province}" if loc else "Unknown address"
    window = f"{order.delivery_window_start.strftime('%H:%M')} - {order.delivery_window_end.strftime('%H:%M')}" if order and order.delivery_window_start and order.delivery_window_end else "Not provided"

    # Try to find a POD
    # Assuming frontend expects these
    pod = None # In a full impl, query ProofOfDelivery

    return StopResponse(
        id=stop.id,
        sequence=stop.sequence_no,
        destination="Destination",
        address=address,
        delivery_window=window,
        status=stop.status,
        weight="10 kg",
        order_no=order.order_no if order else "UNKNOWN",
        recipient="Recipient",
        failure_reason=delivery.failure_reason if delivery else None,
        failure_notes=None,
        pod_photo_name=pod.file_url if pod else None,
        recipient_name=pod.recipient_name if pod else None,
        delivered_at=stop.departed_at.strftime("%H:%M") if stop.departed_at else None
    )

@router.post("", status_code=status.HTTP_201_CREATED)
def build_route(req: RouteCreateRequest, db: Session = Depends(get_db)):
    # Find deliveries assigned to driver but not yet on a route
    deliveries = db.query(Delivery).filter(
        Delivery.driver_id == req.driver_id,
        Delivery.route_id == None,
        Delivery.status == "PENDING"
    ).all()

    if not deliveries:
        raise HTTPException(status_code=400, detail="No pending deliveries for this driver.")

    # Create the route
    route = Route(
        driver_id=req.driver_id,
        vehicle_id=req.vehicle_id,
        shift_id=req.shift_id,
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
    
    from app.services.costing import calculate_route_cost
    calculate_route_cost(db, route.id)
    
    return {"id": route.id, "message": f"Route created with {len(deliveries)} stops."}

@router.get("", response_model=List[RouteAvailableItem])
def get_routes(db: Session = Depends(get_db)):
    routes = db.query(Route).all()
    return [{"id": str(r.id), "status": r.status} for r in routes]

@router.get("/{id}")
def get_route_detail(id: int, db: Session = Depends(get_db)):
    route = db.query(Route).filter(Route.id == id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    driver = db.query(Driver).filter(Driver.id == route.driver_id).first()
    stops = db.query(DeliveryStop).filter(DeliveryStop.route_id == route.id).order_by(DeliveryStop.sequence_no).all()
    
    stop_responses = [get_stop_response(db, s) for s in stops]
    
    return {
        "id": str(route.id),
        "status": route.status,
        "assigned_driver": driver.license_number if driver else "Unknown",
        "vehicle": str(route.vehicle_id) if route.vehicle_id else "Unknown",
        "estimated_remaining_min": 0,
        "stops": stop_responses
    }

@router.post("/{id}/optimize")
def optimize_route_api(id: int, db: Session = Depends(get_db)):
    route = db.query(Route).filter(Route.id == id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    optimize_route(db, id)
    from app.services.costing import calculate_route_cost
    calculate_route_cost(db, id)
    return {"message": "Route optimized"}

@router.patch("/{id}")
def reorder_route(id: int, req: RouteReorderRequest, db: Session = Depends(get_db)):
    route = db.query(Route).filter(Route.id == id).first()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    
    for s in req.stops:
        stop = db.query(DeliveryStop).filter(DeliveryStop.id == s.id, DeliveryStop.route_id == id).first()
        if stop:
            stop.sequence_no = s.sequence_no
            
    db.commit()
    from app.services.costing import calculate_route_cost
    calculate_route_cost(db, id)
    return {"message": "Route stops reordered"}
