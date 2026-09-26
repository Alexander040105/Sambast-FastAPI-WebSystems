import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.db.session import get_db
from app.core.deps import get_current_user, require_role
from app.models.route import Route
from app.models.delivery import Delivery
from app.models.delivery_stop import DeliveryStop
from app.models.order import Order
from app.models.location import Location
from app.models.driver import Driver
from app.models.proof_of_delivery import ProofOfDelivery
from app.models.delivery_status_event import DeliveryStatusEvent
from app.schemas.route import DriverManifestResponse, StopFailRequest
from app.routers.routes import get_stop_response

router = APIRouter(tags=["Driver Workflow"])

def record_event(db: Session, delivery_id: int, status: str, user_id: int, note: str = None):
    event = DeliveryStatusEvent(
        delivery_id=delivery_id,
        status=status,
        note=note,
        actor_user_id=user_id
    )
    db.add(event)
    # TODO: Emit SSE event

@router.get("/me/route", response_model=DriverManifestResponse)
def get_my_route(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    driver = db.query(Driver).filter(Driver.user_id == current_user["sub"]).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver profile not found")
        
    route = db.query(Route).filter(
        Route.driver_id == driver.id,
        Route.status.in_(["planned", "active"])
    ).first()
    
    stops = []
    route_started = False
    
    if route:
        if route.status == "active":
            route_started = True
            
        stop_records = db.query(DeliveryStop).filter(DeliveryStop.route_id == route.id).order_by(DeliveryStop.sequence_no).all()
        stops = [get_stop_response(db, s) for s in stop_records]
        
    return DriverManifestResponse(
        date_label=datetime.now(timezone.utc).strftime("%A, %B %d"),
        shift_label="Active Shift",
        route_started=route_started,
        stops=stops,
        failure_reasons=[
            {"value": "recipient_unavailable", "label": "Recipient unavailable"},
            {"value": "business_closed", "label": "Business closed"},
            {"value": "address_not_found", "label": "Address not found"},
            {"value": "delivery_declined", "label": "Delivery declined"}
        ]
    )

@router.post("/stops/{id}/start")
def start_stop(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    stop = db.query(DeliveryStop).filter(DeliveryStop.id == id).first()
    if not stop:
        raise HTTPException(404, "Stop not found")
    
    stop.status = "EN_ROUTE"
    db.commit()
    
    # Also mark delivery
    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    if delivery:
        delivery.status = "EN_ROUTE"
        record_event(db, delivery.id, "EN_ROUTE", current_user["sub"])
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order:
            order.status = "OUT_FOR_DELIVERY"
            
    # Mark route active
    route = db.query(Route).filter(Route.id == stop.route_id).first()
    if route and route.status == "planned":
        route.status = "active"
        
    db.commit()
    return get_my_route(db, current_user)

@router.post("/stops/{id}/arrive")
def arrive_stop(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    stop = db.query(DeliveryStop).filter(DeliveryStop.id == id).first()
    if not stop:
        raise HTTPException(404, "Stop not found")
        
    stop.status = "ARRIVED"
    stop.arrived_at = datetime.now(timezone.utc)
    db.commit()
    
    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    if delivery:
        delivery.status = "ARRIVED"
        record_event(db, delivery.id, "ARRIVED", current_user["sub"])
        db.commit()
        
    return get_my_route(db, current_user)

@router.post("/deliveries/{id}/pod")
def upload_pod(
    id: int, 
    photo: UploadFile = File(...),
    recipient_name: str = Form(None),
    db: Session = Depends(get_db), 
    current_user: dict = Depends(get_current_user)
):
    delivery = db.query(Delivery).filter(Delivery.id == id).first()
    if not delivery:
        raise HTTPException(404, "Delivery not found")
        
    os.makedirs("uploads", exist_ok=True)
    file_path = f"uploads/{photo.filename}"
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(photo.file, buffer)
        
    pod = ProofOfDelivery(
        delivery_id=id,
        type="photo",
        file_url=file_path,
        recipient_name=recipient_name,
        captured_at=datetime.now(timezone.utc)
    )
    db.add(pod)
    db.commit()
    return {"message": "POD saved successfully", "file_url": file_path}

@router.post("/stops/{id}/complete")
def complete_stop(id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    stop = db.query(DeliveryStop).filter(DeliveryStop.id == id).first()
    if not stop:
        raise HTTPException(404, "Stop not found")
        
    stop.status = "DELIVERED"
    stop.departed_at = datetime.now(timezone.utc)
    
    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    if delivery:
        delivery.status = "DELIVERED"
        record_event(db, delivery.id, "DELIVERED", current_user["sub"])
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order:
            order.status = "COMPLETED"
            
    db.commit()
    return get_my_route(db, current_user)

@router.post("/stops/{id}/fail")
def fail_stop(id: int, payload: StopFailRequest, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    stop = db.query(DeliveryStop).filter(DeliveryStop.id == id).first()
    if not stop:
        raise HTTPException(404, "Stop not found")
        
    stop.status = "FAILED"
    stop.departed_at = datetime.now(timezone.utc)
    
    delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
    if delivery:
        delivery.status = "FAILED"
        delivery.failure_reason = payload.reason
        record_event(db, delivery.id, "FAILED", current_user["sub"], payload.notes)
        order = db.query(Order).filter(Order.id == delivery.order_id).first()
        if order:
            order.status = "READY_FOR_DISPATCH" # re-queue to dispatch
            
    db.commit()
    return get_my_route(db, current_user)
