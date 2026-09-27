from sqlalchemy.orm import Session
from app.models.order import Order
from app.models.route import Route
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.delivery import Delivery
from app.models.delivery_stop import DeliveryStop
from app.models.location import Location
from app.services.routing import haversine, SPEED_KMH

VEHICLE_TYPE_RATES = {
    "motorcycle": 1.0,
    "van": 1.5,
    "truck": 2.2,
    "car": 1.2,
}
DEFAULT_VEHICLE_RATE = 1.5
DEFAULT_DRIVER_RATE = 20.0


def calculate_order_delivery_fee(db: Session, order_id: int, distance_km: float = 10.0) -> float:
    """
    Costing v1: base + per-km
    """
    base_fee = 5.00
    per_km_rate = 0.50
    return base_fee + (distance_km * per_km_rate)


def calculate_route_cost(db: Session, route_id: int) -> float:
    """
    Costing v2: distance * vehicle rate + driver time -> routes.cost
    Allocates cost to deliveries and reconciles orders.delivery_fee.
    """
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        return 0.0

    vehicle = db.query(Vehicle).filter(Vehicle.id == route.vehicle_id).first() if route.vehicle_id else None
    vehicle_rate = DEFAULT_VEHICLE_RATE
    if vehicle and vehicle.type:
        vehicle_rate = VEHICLE_TYPE_RATES.get(vehicle.type.lower(), DEFAULT_VEHICLE_RATE)

    driver_rate = DEFAULT_DRIVER_RATE

    stops = db.query(DeliveryStop).filter(DeliveryStop.route_id == route_id).order_by(DeliveryStop.sequence_no).all()
    if not stops:
        route.cost = 0.0
        db.commit()
        return 0.0

    total_distance_km = float(route.total_distance_km or 0.0)
    est_duration_min = float(route.est_duration_min or 0.0)

    if total_distance_km <= 0.0 or est_duration_min <= 0.0:
        prev_lat, prev_lng = None, None
        calc_dist = 0.0
        for stop in stops:
            if stop.location_id:
                loc = db.query(Location).filter(Location.id == stop.location_id).first()
                if loc and loc.lat and loc.lng:
                    lat, lng = float(loc.lat), float(loc.lng)
                    if prev_lat is not None and (prev_lat != 0.0 or prev_lng != 0.0):
                        calc_dist += haversine(prev_lat, prev_lng, lat, lng)
                    prev_lat, prev_lng = lat, lng
        total_distance_km = calc_dist
        est_duration_min = (calc_dist / SPEED_KMH) * 60.0 + (len(stops) * 10.0)
        route.total_distance_km = round(total_distance_km, 2)
        route.est_duration_min = round(est_duration_min, 2)

    estimated_time_hours = est_duration_min / 60.0
    total_cost = round((total_distance_km * vehicle_rate) + (estimated_time_hours * driver_rate), 2)
    route.cost = total_cost

    # Allocate cost to deliveries and reconcile orders.delivery_fee
    deliveries = db.query(Delivery).filter(Delivery.route_id == route_id).all()
    if deliveries:
        per_delivery_cost = round(total_cost / len(deliveries), 2)
        for d in deliveries:
            d.cost = per_delivery_cost
            if d.order_id:
                order = db.query(Order).filter(Order.id == d.order_id).first()
                if order:
                    order.delivery_fee = per_delivery_cost
                    subtotal = float(order.subtotal or 0.0)
                    discount = float(order.discount_total or 0.0)
                    order.total_price = round(subtotal - discount + per_delivery_cost, 2)

    db.commit()
    return total_cost
