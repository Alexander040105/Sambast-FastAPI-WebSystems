"""services/assignment.py — auto-assign logic."""

import math
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.driver import Driver
from app.models.driver_shift import DriverShift
from app.models.vehicle import Vehicle
from app.models.location import Location


def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate haversine distance in km."""
    if None in (lat1, lon1, lat2, lon2):
        return float('inf')
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) * math.sin(dlat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) * math.sin(dlon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def get_auto_assign_suggestion(order_id: int, db: Session) -> dict:
    # 1. Fetch Order
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        return {"driver_id": None, "vehicle_id": None, "reason": "Order not found"}
    
    if order.status != "READY_FOR_DISPATCH":
        return {"driver_id": None, "vehicle_id": None, "reason": "Order is not READY_FOR_DISPATCH"}
        
    order_location = db.query(Location).filter(Location.id == order.delivery_location_id).first()

    # Calculate total weight
    items = db.query(OrderItem, Product).outerjoin(Product, OrderItem.product_id == Product.id)\
              .filter(OrderItem.order_id == order_id).all()
    
    total_weight = 0.0
    for item, product in items:
        # (products.weight_kg_per_unit x qty x unit_multiplier)
        kg_per_unit = float(product.weight_kg_per_unit) if product and product.weight_kg_per_unit else 0.0
        total_weight += kg_per_unit * float(item.quantity) * float(item.unit_multiplier)

    # 2. Filter Drivers (Active Shift now)
    now = datetime.now(timezone.utc)
    
    active_shifts = db.query(DriverShift, Driver, Vehicle)\
        .join(Driver, DriverShift.driver_id == Driver.id)\
        .outerjoin(Vehicle, DriverShift.vehicle_id == Vehicle.id)\
        .filter(
            DriverShift.starts_at <= now,
            DriverShift.ends_at >= now,
            DriverShift.status.in_(["active", "scheduled"]),
            Driver.status == "active",
        ).all()

    if not active_shifts:
        return {"driver_id": None, "vehicle_id": None, "reason": "No drivers currently on active shift"}

    candidates = []
    
    for shift, driver, vehicle in active_shifts:
        # Filter Capacity
        if not vehicle or not vehicle.is_active:
            continue
        if float(vehicle.max_weight_kg) < total_weight:
            continue

        # Filter Time Window
        if order.delivery_window_start and order.delivery_window_end:
            if shift.starts_at > order.delivery_window_end or shift.ends_at < order.delivery_window_start:
                continue
                
        # Score proximity
        dist = float('inf')
        if order_location and order_location.lat and order_location.lng:
            driver_loc = db.query(Location).filter(Location.id == driver.home_location_id).first()
            if driver_loc and driver_loc.lat and driver_loc.lng:
                dist = calculate_distance(
                    float(driver_loc.lat), float(driver_loc.lng),
                    float(order_location.lat), float(order_location.lng)
                )

        candidates.append({
            "shift": shift,
            "driver": driver,
            "vehicle": vehicle,
            "dist": dist
        })

    if not candidates:
        return {"driver_id": None, "vehicle_id": None, "reason": "No active drivers have enough vehicle capacity or fit the time window"}

    # Sort by proximity
    candidates.sort(key=lambda x: x["dist"])
    best = candidates[0]
    
    dist_str = f"{best['dist']:.1f}km away" if best['dist'] != float('inf') else "unknown distance"
    reason = f"Assigned driver {best['driver'].id} ({dist_str}) with sufficient capacity (Needs {total_weight:.1f}kg, Vehicle supports {float(best['vehicle'].max_weight_kg):.1f}kg)."

    return {
        "driver_id": best['driver'].id,
        "vehicle_id": best['vehicle'].id,
        "reason": reason
    }
