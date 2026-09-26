import math
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.delivery_stop import DeliveryStop
from app.models.location import Location

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

def optimize_route(db: Session, route_id: int):
    stops = db.query(DeliveryStop).filter(DeliveryStop.route_id == route_id).all()
    if not stops:
        return []

    # Get locations for stops
    stop_locs = []
    for s in stops:
        if s.location_id:
            loc = db.query(Location).filter(Location.id == s.location_id).first()
            if loc and loc.lat and loc.lng:
                stop_locs.append((s, float(loc.lat), float(loc.lng)))
            else:
                stop_locs.append((s, 0.0, 0.0))
        else:
            stop_locs.append((s, 0.0, 0.0))

    if not stop_locs:
        return stops

    # Nearest neighbor
    # For simplicity, start from the first one in the list (or a depot if we had one)
    optimized = []
    current = stop_locs.pop(0)
    optimized.append(current)

    while stop_locs:
        closest = min(stop_locs, key=lambda x: haversine(current[1], current[2], x[1], x[2]))
        stop_locs.remove(closest)
        optimized.append(closest)
        current = closest

    # Assign new sequence numbers
    for idx, (stop, _, _) in enumerate(optimized):
        stop.sequence_no = idx + 1

    db.commit()
    return [s for s, _, _ in optimized]
