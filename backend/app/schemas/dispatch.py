"""dispatch schemas — queue, assignment, and recommendation outputs."""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from app.schemas.fleet import LocationOut


class DispatchQueueOrderOut(BaseModel):
    id: int
    order_no: str
    delivery_window_start: Optional[datetime] = None
    delivery_window_end: Optional[datetime] = None
    delivery_location: Optional[LocationOut] = None
    total_weight_kg: float

    model_config = {"from_attributes": True}


class DispatchQueueResponse(BaseModel):
    data: List[DispatchQueueOrderOut]
    
    
class ManualAssignRequest(BaseModel):
    driver_id: int
    vehicle_id: Optional[int] = None
    
    
class AutoAssignRequest(BaseModel):
    order_id: int


class AutoAssignResponse(BaseModel):
    driver_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    reason: str
