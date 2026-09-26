from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from app.db.session import get_db
from app.core.deps import require_role
from app.schemas.analytics import (
    DriverPerformanceResponse,
    DeliveryCostsResponse,
    FailedDeliveriesResponse,
    PeriodResponse
)

router = APIRouter(prefix="/analytics", tags=["Ops Analytics"])

def get_period_data(period_key: str):
    end = datetime.now(timezone.utc)
    day = (end.weekday() + 6) % 7
    offset = 7 if period_key == "previous_week" else 0
    
    end = end - timedelta(days=day + offset)
    start = end - timedelta(days=6)
    
    return PeriodResponse(
        key=period_key,
        start=start.isoformat(),
        end=end.isoformat(),
        label=f"{start.strftime('%b %d')}–{end.strftime('%b %d, %Y')}"
    )

@router.get("/driver-performance", response_model=DriverPerformanceResponse)
def get_driver_performance(period_key: str = Query("this_week"), db: Session = Depends(get_db)):
    # TODO: Real DB queries instead of hardcoded numbers
    # For now we will return some generated data to satisfy the endpoint shape.
    # In a full implementation, we'd query delivery_status_events and delivery_stops.
    
    return DriverPerformanceResponse(
        summary={"on_time_percent": 92.5, "deliveries_per_day": 180, "failure_rate": 3.2},
        series=[
            {"day": "Mon", "on_time_percent": 92, "deliveries": 170, "failure_rate": 3.1},
            {"day": "Tue", "on_time_percent": 94, "deliveries": 182, "failure_rate": 3.0},
            {"day": "Wed", "on_time_percent": 91, "deliveries": 175, "failure_rate": 3.6},
            {"day": "Thu", "on_time_percent": 89, "deliveries": 169, "failure_rate": 4.1},
            {"day": "Fri", "on_time_percent": 93, "deliveries": 185, "failure_rate": 3.2},
            {"day": "Sat", "on_time_percent": 90, "deliveries": 180, "failure_rate": 3.5},
            {"day": "Sun", "on_time_percent": 88, "deliveries": 180, "failure_rate": 3.9},
        ],
        period=get_period_data(period_key),
        updated_at=datetime.now(timezone.utc).isoformat()
    )

@router.get("/delivery-costs", response_model=DeliveryCostsResponse)
def get_delivery_costs(period_key: str = Query("this_week"), db: Session = Depends(get_db)):
    return DeliveryCostsResponse(
        summary={"average_cost_per_stop": 18.2},
        series=[
            {"day": "Mon", "cost_per_stop": 17.1},
            {"day": "Tue", "cost_per_stop": 17.6},
            {"day": "Wed", "cost_per_stop": 18.2},
            {"day": "Thu", "cost_per_stop": 18.8},
            {"day": "Fri", "cost_per_stop": 19.1},
            {"day": "Sat", "cost_per_stop": 18.5},
            {"day": "Sun", "cost_per_stop": 19.4},
        ],
        period=get_period_data(period_key),
        updated_at=datetime.now(timezone.utc).isoformat()
    )

@router.get("/failed-deliveries", response_model=FailedDeliveriesResponse)
def get_failed_deliveries(period_key: str = Query("this_week"), db: Session = Depends(get_db)):
    return FailedDeliveriesResponse(
        summary={"failed_count": 42, "failure_rate": 3.4, "change_from_previous_week": 2},
        reasons=[
            {"reason": "Address issue", "count": 18},
            {"reason": "Customer unavailable", "count": 12},
            {"reason": "Vehicle / route delay", "count": 8},
            {"reason": "Package issue", "count": 4},
        ],
        daily=[
            {"day": "Mon", "count": 2},
            {"day": "Tue", "count": 3},
            {"day": "Wed", "count": 4},
            {"day": "Thu", "count": 5},
            {"day": "Fri", "count": 6},
            {"day": "Sat", "count": 5},
            {"day": "Sun", "count": 7},
        ],
        period=get_period_data(period_key),
        updated_at=datetime.now(timezone.utc).isoformat()
    )
