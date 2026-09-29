from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class PeriodResponse(BaseModel):
    key: str
    start: str
    end: str
    label: str

class DriverPerformanceSummary(BaseModel):
    on_time_percent: float
    deliveries_per_day: int
    failure_rate: float

class DriverPerformanceDay(BaseModel):
    day: str
    on_time_percent: float
    deliveries: int
    failure_rate: float

class DriverPerformanceResponse(BaseModel):
    summary: DriverPerformanceSummary
    series: List[DriverPerformanceDay]
    period: PeriodResponse
    updated_at: str

class DeliveryCostsSummary(BaseModel):
    average_cost_per_stop: float

class DeliveryCostsDay(BaseModel):
    day: str
    cost_per_stop: float

class DeliveryCostsResponse(BaseModel):
    summary: DeliveryCostsSummary
    series: List[DeliveryCostsDay]
    period: PeriodResponse
    updated_at: str

class FailedDeliveriesSummary(BaseModel):
    failed_count: int
    failure_rate: float
    change_from_previous_week: int

class FailedReason(BaseModel):
    reason: str
    count: int

class FailedDaily(BaseModel):
    day: str
    count: int

class FailedDeliveriesResponse(BaseModel):
    summary: FailedDeliveriesSummary
    reasons: List[FailedReason]
    daily: List[FailedDaily]
    period: PeriodResponse
    updated_at: str
