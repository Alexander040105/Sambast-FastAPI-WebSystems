from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class StopUpdateSequence(BaseModel):
    id: int
    sequence_no: int

class RouteReorderRequest(BaseModel):
    stops: List[StopUpdateSequence]

class RouteCreateRequest(BaseModel):
    driver_id: int
    vehicle_id: Optional[int] = None
    shift_id: Optional[int] = None

class RouteResponse(BaseModel):
    id: int
    status: str
    driver_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    shift_id: Optional[int] = None

class StopResponse(BaseModel):
    id: int
    sequence: int
    destination: str
    address: str
    delivery_window: str
    status: str
    weight: Optional[str] = None
    order_no: str
    recipient: str
    failure_reason: Optional[str] = None
    failure_notes: Optional[str] = None
    pod_photo_name: Optional[str] = None
    recipient_name: Optional[str] = None
    delivered_at: Optional[str] = None

class RouteDetailResponse(BaseModel):
    id: str
    status: str
    assigned_driver: str
    vehicle: str
    estimated_remaining_min: int
    stops: List[StopResponse]

class RouteAvailableItem(BaseModel):
    id: str
    status: str

class RouteListResponse(BaseModel):
    items: List[RouteAvailableItem]

class DriverManifestResponse(BaseModel):
    date_label: str
    shift_label: str
    route_started: bool
    stops: List[StopResponse]
    failure_reasons: List[dict]

class StopFailRequest(BaseModel):
    reason: str
    notes: Optional[str] = None
