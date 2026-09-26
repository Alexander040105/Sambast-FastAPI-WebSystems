from sqlalchemy.orm import Session
from app.models.order import Order
from app.models.route import Route
from app.models.vehicle import Vehicle
from app.models.driver import Driver
from app.models.delivery_stop import DeliveryStop

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
    For this to be precise, we need vehicle operating costs and driver hourly rates.
    For demonstration, we use constants if they are not in the DB.
    """
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        return 0.0

    vehicle = db.query(Vehicle).filter(Vehicle.id == route.vehicle_id).first()
    driver = db.query(Driver).filter(Driver.id == route.driver_id).first()
    
    # Assume 1.5/km vehicle rate and 20/hr driver rate
    vehicle_rate = 1.5 
    driver_rate = 20.0 
    
    total_distance_km = 0.0 # Could calculate via haversine over stops
    stops = db.query(DeliveryStop).filter(DeliveryStop.route_id == route_id).all()
    
    # Very simple mock of distance based on number of stops * average gap
    total_distance_km = len(stops) * 3.5
    
    estimated_time_hours = (total_distance_km / 30.0) + (len(stops) * 0.25) # 30km/h + 15 min per stop
    
    cost = (total_distance_km * vehicle_rate) + (estimated_time_hours * driver_rate)
    
    # Write cost to route
    route.cost = cost
    db.commit()
    return cost
