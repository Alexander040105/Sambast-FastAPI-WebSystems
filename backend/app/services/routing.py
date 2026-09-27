import math
from typing import List, Tuple
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
from app.models.delivery_stop import DeliveryStop
from app.models.location import Location
from app.models.delivery import Delivery
from app.models.order import Order
from app.models.route import Route

SPEED_KMH = 30.0

def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0 # Radius of Earth in km
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad

    a = math.sin(dlat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def route_cost(route: List[Tuple], start_time: datetime) -> float:
    dist = 0.0
    current_time = start_time
    penalty = 0.0
    
    for i in range(len(route)):
        if i > 0:
            segment_dist = haversine(route[i-1][1], route[i-1][2], route[i][1], route[i][2])
            dist += segment_dist
            travel_time_hours = segment_dist / SPEED_KMH
            current_time += timedelta(hours=travel_time_hours)
        
        order = route[i][3]
        if order:
            window_start = order.delivery_window_start
            window_end = order.delivery_window_end
            
            # Driver arrives early, must wait until window_start
            if window_start and current_time < window_start:
                current_time = window_start
            
            # Driver arrives late, penalize heavily
            if window_end and current_time > window_end:
                lateness_hours = (current_time - window_end).total_seconds() / 3600.0
                penalty += lateness_hours * 500.0  # 500 penalty km per hour late
                
    return dist + penalty

def optimize_route(db: Session, route_id: int):
    stops = db.query(DeliveryStop).filter(DeliveryStop.route_id == route_id).all()
    if not stops:
        return []
    if len(stops) < 2:
        recompute_route_metrics(db, route_id)
        return stops

    route_obj = db.query(Route).filter(Route.id == route_id).first()
    start_time = datetime.now(timezone.utc)

    # 1. Data Hydration
    stop_locs = []
    for s in stops:
        lat, lng = 0.0, 0.0
        delivery = db.query(Delivery).filter(Delivery.id == s.delivery_id).first()
        order = db.query(Order).filter(Order.id == delivery.order_id).first() if delivery else None
        
        if s.location_id:
            loc = db.query(Location).filter(Location.id == s.location_id).first()
            if loc and loc.lat and loc.lng:
                lat, lng = float(loc.lat), float(loc.lng)
        
        stop_locs.append((s, lat, lng, order))

    # 2. Nearest Neighbor Initialization (Greedy by Time+Distance Cost)
    optimized = []
    
    # Pick starting node: Earliest window start
    stop_locs.sort(key=lambda x: (x[3].delivery_window_start if x[3] and x[3].delivery_window_start else datetime.max.replace(tzinfo=timezone.utc)))
    
    current = stop_locs.pop(0)
    optimized.append(current)

    while stop_locs:
        best_next = None
        best_next_cost = float('inf')
        
        for candidate in stop_locs:
            test_route = optimized + [candidate]
            cost = route_cost(test_route, start_time)
            if cost < best_next_cost:
                best_next = candidate
                best_next_cost = cost
                
        stop_locs.remove(best_next)
        optimized.append(best_next)

    # 3. 2-opt Algorithm with Cost Function
    improvement = True
    best_cost = route_cost(optimized, start_time)
    
    while improvement:
        improvement = False
        for i in range(len(optimized) - 1):
            for j in range(i + 2, len(optimized) + 1):
                if i == 0 and j == len(optimized):
                    continue 
                
                new_route = optimized[:i] + optimized[i:j][::-1] + optimized[j:]
                new_cost = route_cost(new_route, start_time)
                
                if new_cost < best_cost - 0.0001:
                    optimized = new_route
                    best_cost = new_cost
                    improvement = True
                    break 
            if improvement:
                break

    # 4. Persistence
    for idx, (stop, _, _, _) in enumerate(optimized):
        stop.sequence_no = idx + 1

    db.commit()
    recompute_route_metrics(db, route_id)
    return [s for s, _, _, _ in optimized]


def recompute_route_metrics(db: Session, route_id: int):
    route_obj = db.query(Route).filter(Route.id == route_id).first()
    if not route_obj:
        return

    stops = (
        db.query(DeliveryStop)
        .filter(DeliveryStop.route_id == route_id)
        .order_by(DeliveryStop.sequence_no)
        .all()
    )
    if not stops:
        route_obj.total_distance_km = 0.0
        route_obj.est_duration_min = 0.0
        db.commit()
        return

    start_time = datetime.now(timezone.utc)
    current_time = start_time
    total_dist = 0.0
    prev_lat, prev_lng = None, None

    for idx, stop in enumerate(stops):
        stop.sequence_no = idx + 1
        delivery = db.query(Delivery).filter(Delivery.id == stop.delivery_id).first()
        order = db.query(Order).filter(Order.id == delivery.order_id).first() if delivery else None

        lat, lng = 0.0, 0.0
        if stop.location_id:
            loc = db.query(Location).filter(Location.id == stop.location_id).first()
            if loc and loc.lat and loc.lng:
                lat, lng = float(loc.lat), float(loc.lng)

        if prev_lat is not None and (lat != 0.0 or lng != 0.0) and (prev_lat != 0.0 or prev_lng != 0.0):
            seg_dist = haversine(prev_lat, prev_lng, lat, lng)
            total_dist += seg_dist
            travel_time_hours = seg_dist / SPEED_KMH
            current_time += timedelta(hours=travel_time_hours)

        if order and order.delivery_window_start and current_time < order.delivery_window_start:
            current_time = order.delivery_window_start

        stop.planned_eta = current_time
        current_time += timedelta(minutes=10)
        prev_lat, prev_lng = lat, lng

    travel_duration_min = (total_dist / SPEED_KMH) * 60.0 + (len(stops) * 10.0)
    route_obj.total_distance_km = round(total_dist, 2)
    route_obj.est_duration_min = round(travel_duration_min, 2)
    db.commit()

