import os
import sys
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.db.session import SessionLocal
from app.models.delivery import Delivery
from app.models.delivery_stop import DeliveryStop
from app.models.order import Order
from app.models.route import Route
from app.services.routing import optimize_route, route_cost, haversine

def test_optimizer():
    db = SessionLocal()
    try:
        # Find some deliveries assigned to a driver that are not in a route yet
        # If none, we'll create a dummy route with some existing deliveries
        deliveries = db.query(Delivery).limit(10).all()
        if not deliveries:
            print("No deliveries in DB to test with!")
            return

        print(f"Creating a test route with {len(deliveries)} deliveries...")
        route = Route(
            driver_id=deliveries[0].driver_id,
            date=datetime.now(timezone.utc).date(),
            status="planned"
        )
        db.add(route)
        db.flush()

        for idx, d in enumerate(deliveries):
            d.route_id = route.id
            order = db.query(Order).filter(Order.id == d.order_id).first()
            stop = DeliveryStop(
                route_id=route.id,
                delivery_id=d.id,
                location_id=order.delivery_location_id if order else None,
                sequence_no=idx + 1
            )
            db.add(stop)
        
        db.commit()
        db.refresh(route)

        print(f"Testing optimize_route for Route {route.id}...")
        optimized_stops = optimize_route(db, route.id)
        
        print("\nOptimized Route Stops:")
        for s in optimized_stops:
            delivery = db.query(Delivery).filter(Delivery.id == s.delivery_id).first()
            order = db.query(Order).filter(Order.id == delivery.order_id).first()
            print(f"Stop ID: {s.id} | Seq: {s.sequence_no} | Loc: {s.location_id} | Window: {order.delivery_window_start.strftime('%H:%M')} - {order.delivery_window_end.strftime('%H:%M')}")
        
        print("\nOptimization completed successfully without crashing.")
    except Exception as e:
        print(f"Error testing optimizer: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    test_optimizer()
