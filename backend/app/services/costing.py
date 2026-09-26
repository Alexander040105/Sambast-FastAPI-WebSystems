"""
services/costing.py — delivery fee v1 (BE-A T6).

fee = DELIVERY_BASE_FEE + DELIVERY_PER_KM x distance_km

Distance is haversine warehouse → delivery location, reusing
calculate_distance from services/assignment.py. When the delivery address
couldn't be geocoded (lat/lng missing) we fall back to just the base fee —
never block checkout over a missing pin.
"""

from decimal import Decimal, ROUND_HALF_UP

from app.core.config import settings
from app.services.assignment import calculate_distance

CENT = Decimal("0.01")


def delivery_fee_for_location(dest_lat, dest_lng) -> Decimal:
    distance_km = calculate_distance(
        settings.WAREHOUSE_LAT,
        settings.WAREHOUSE_LNG,
        float(dest_lat) if dest_lat is not None else None,
        float(dest_lng) if dest_lng is not None else None,
    )

    # calculate_distance returns inf when a coordinate is missing
    if distance_km == float("inf"):
        distance_km = 0.0

    fee = Decimal(str(settings.DELIVERY_BASE_FEE)) + (
        Decimal(str(settings.DELIVERY_PER_KM)) * Decimal(str(distance_km))
    )
    return fee.quantize(CENT, rounding=ROUND_HALF_UP)
