import os
import sys
import uuid
import random
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from sqlalchemy import text

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from app.db.session import SessionLocal
from app.models.user import User
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.driver_shift import DriverShift
from app.models.location import Location
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.delivery import Delivery
from app.models.delivery_stop import DeliveryStop
from app.models.delivery_status_event import DeliveryStatusEvent
from app.models.product import Product
from app.models.category import Category
from app.models.payment import Payment
from app.models.proof_of_delivery import ProofOfDelivery
from app.models.route import Route
from app.core.security import hash_password

LOCATIONS = [
    {"line1": "Ayala Triangle", "city": "Makati", "province": "Metro Manila", "lat": 14.5547, "lng": 121.0244},
    {"line1": "High Street", "city": "Taguig", "province": "Metro Manila", "lat": 14.5409, "lng": 121.0503},
    {"line1": "Araneta Center", "city": "Quezon City", "province": "Metro Manila", "lat": 14.6178, "lng": 121.0572},
    {"line1": "Ortigas Center", "city": "Pasig", "province": "Metro Manila", "lat": 14.5833, "lng": 121.0583},
    {"line1": "SM Megamall", "city": "Mandaluyong", "province": "Metro Manila", "lat": 14.5838, "lng": 121.0566},
    {"line1": "Rizal Park", "city": "Manila", "province": "Metro Manila", "lat": 14.5818, "lng": 120.9770},
    {"line1": "Mall of Asia", "city": "Pasay", "province": "Metro Manila", "lat": 14.5350, "lng": 120.9822},
    {"line1": "Greenhills", "city": "San Juan", "province": "Metro Manila", "lat": 14.6042, "lng": 121.0333},
    {"line1": "Alabang Town Center", "city": "Muntinlupa", "province": "Metro Manila", "lat": 14.4253, "lng": 121.0267},
    {"line1": "BF Homes", "city": "Paranaque", "province": "Metro Manila", "lat": 14.4446, "lng": 121.0182},
]

def clean_db(db):
    print("Cleaning database...")
    db.execute(text("TRUNCATE TABLE delivery_status_events, proof_of_delivery, delivery_stops, deliveries, routes, orders, locations, driver_shifts, drivers, vehicles, users RESTART IDENTITY CASCADE"))
    db.commit()

def seed():
    db = SessionLocal()
    try:
        clean_db(db)

        print("Seeding Users (5 roles)...")
        roles = ["admin", "dispatcher", "ops_manager", "driver", "customer"]
        users = {}
        for role in roles:
            user = User(
                email=f"{role}@sambast.local",
                password_hash=hash_password("password123"),
                name=f"{role.capitalize()} User",
                role=role
            )
            db.add(user)
            users[role] = user
        
        # Add a couple more drivers
        extra_drivers = []
        for i in range(2, 4):
            driver_user = User(
                email=f"driver{i}@sambast.local",
                password_hash=hash_password("password123"),
                name=f"Driver Dave {i}",
                role="driver"
            )
            db.add(driver_user)
            extra_drivers.append(driver_user)
        
        db.flush()

        print("Seeding Locations...")
        db_locations = []
        for loc_data in LOCATIONS:
            loc = Location(
                line1=loc_data["line1"],
                city=loc_data["city"],
                province=loc_data["province"],
                postal_code="1000",
                lat=loc_data["lat"],
                lng=loc_data["lng"],
                place_id=f"seed_loc_{uuid.uuid4().hex[:8]}"
            )
            db.add(loc)
            db_locations.append(loc)
        db.flush()

        print("Seeding Vehicles...")
        vehicles = [
            Vehicle(plate_no="VAN-123", type="VAN", max_weight_kg=1000.0, max_volume_m3=10.0, is_active=True),
            Vehicle(plate_no="TRK-456", type="TRUCK", max_weight_kg=3000.0, max_volume_m3=20.0, is_active=True),
            Vehicle(plate_no="MTC-789", type="MOTORCYCLE", max_weight_kg=50.0, max_volume_m3=0.5, is_active=True)
        ]
        for v in vehicles:
            db.add(v)
        db.flush()

        print("Seeding Drivers and Shifts...")
        all_driver_users = [users["driver"]] + extra_drivers
        drivers = []
        for i, user in enumerate(all_driver_users):
            driver = Driver(
                user_id=user.id,
                license_no=f"DL-{uuid.uuid4().hex[:8].upper()}",
                status="active",
                home_location_id=db_locations[0].id if db_locations else None
            )
            db.add(driver)
            drivers.append(driver)
        db.flush()

        # Create active shifts
        driver_shifts = []
        for i, driver in enumerate(drivers):
            shift = DriverShift(
                driver_id=driver.id,
                vehicle_id=vehicles[i % len(vehicles)].id,
                starts_at=datetime.now(timezone.utc) - timedelta(hours=2),
                ends_at=datetime.now(timezone.utc) + timedelta(hours=10),
                status="active"
            )
            db.add(shift)
            driver_shifts.append(shift)
        db.flush()

        print("Seeding Sample Products...")
        sample_prod = db.query(Product).first()
        if not sample_prod:
            sample_prod = Product(
                name="Mineral Water 5 Gal",
                base_price=50.0,
                weight_kg_per_unit=19.0,
            )
            db.add(sample_prod)
            db.flush()

        print("Seeding ~100 Orders, Deliveries, Routes, and Stops...")
        customer_id = users["customer"].id
        
        statuses = [
            ("READY_FOR_DISPATCH", 60), 
            ("ASSIGNED", 15), 
            ("OUT_FOR_DELIVERY", 10), 
            ("DELIVERED", 10), 
            ("FAILED", 5)
        ]

        now = datetime.now(timezone.utc)

        # Create active routes for drivers
        driver_routes = {}
        driver_stop_counts = {}
        for i, driver in enumerate(drivers):
            route = Route(
                driver_id=driver.id,
                vehicle_id=vehicles[i % len(vehicles)].id,
                shift_id=driver_shifts[i].id if i < len(driver_shifts) else None,
                date=now.date(),
                status="active",
            )
            db.add(route)
            db.flush()
            driver_routes[driver.id] = route
            driver_stop_counts[driver.id] = 0

        for status, count in statuses:
            for i in range(count):
                loc = random.choice(db_locations)
                
                # Setup dynamic time windows relative to now so demo auto-assign always works
                if i % 2 == 0:
                    start_window = now - timedelta(hours=1)
                    end_window = now + timedelta(hours=6)
                else:
                    start_window = now + timedelta(hours=1)
                    end_window = now + timedelta(hours=8)
                
                order = Order(
                    order_no=f"ORD-{uuid.uuid4().hex[:8].upper()}",
                    customer_id=customer_id,
                    delivery_location_id=loc.id,
                    status=status,
                    delivery_window_start=start_window,
                    delivery_window_end=end_window,
                    subtotal=round(random.uniform(500, 5000), 2),
                    delivery_fee=150.0,
                    total_price=0
                )
                order.total_price = float(order.subtotal) + float(order.delivery_fee)
                db.add(order)
                db.flush()

                # Add order item
                item = OrderItem(
                    order_id=order.id,
                    product_id=sample_prod.id,
                    quantity=random.randint(1, 3),
                    unit_multiplier=1.0,
                    base_price_at_time=sample_prod.base_price,
                    price_at_time=sample_prod.base_price,
                )
                db.add(item)
                
                # If assigned or beyond, create delivery, stop, and status events
                if status in ["ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"]:
                    driver = random.choice(drivers)
                    route = driver_routes[driver.id]
                    del_status = "PENDING"
                    stop_status = "PENDING"
                    if status == "OUT_FOR_DELIVERY":
                        del_status = "EN_ROUTE"
                        stop_status = "EN_ROUTE"
                    elif status == "DELIVERED":
                        del_status = "DELIVERED"
                        stop_status = "DELIVERED"
                    elif status == "FAILED":
                        del_status = "FAILED"
                        stop_status = "FAILED"
                        
                    delivery = Delivery(
                        order_id=order.id,
                        driver_id=driver.id,
                        route_id=route.id,
                        status=del_status,
                        assigned_at=now - timedelta(hours=1),
                        cost=50.0
                    )
                    
                    if status == "FAILED":
                        delivery.failure_reason = random.choice([
                            "Customer unavailable",
                            "Address issue",
                            "Vehicle / route delay",
                            "Package issue"
                        ])
                        
                    db.add(delivery)
                    db.flush()

                    driver_stop_counts[driver.id] += 1
                    seq = driver_stop_counts[driver.id]
                    departed = (now - timedelta(minutes=15)) if status == "DELIVERED" else None
                    stop = DeliveryStop(
                        route_id=route.id,
                        delivery_id=delivery.id,
                        location_id=loc.id,
                        sequence_no=seq,
                        planned_eta=now + timedelta(minutes=20 * seq),
                        status=stop_status,
                        arrived_at=now - timedelta(minutes=30) if status in ["DELIVERED", "FAILED"] else None,
                        departed_at=departed,
                    )
                    db.add(stop)

                    # Delivery Status Event
                    event_status = "ASSIGNED"
                    if status == "OUT_FOR_DELIVERY":
                        event_status = "EN_ROUTE"
                    elif status == "DELIVERED":
                        event_status = "DELIVERED"
                    elif status == "FAILED":
                        event_status = "FAILED"

                    event = DeliveryStatusEvent(
                        delivery_id=delivery.id,
                        status=event_status,
                        note="Seeded demo status event",
                        actor_user_id=users["dispatcher"].id,
                    )
                    db.add(event)

                    if status == "DELIVERED":
                        pod = ProofOfDelivery(
                            delivery_id=delivery.id,
                            file_url="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=400",
                            recipient_name="Maria Santos",
                        )
                        db.add(pod)

        # Recompute route metrics and costs
        from app.services.routing import recompute_route_metrics
        from app.services.costing import calculate_route_cost
        for route in driver_routes.values():
            recompute_route_metrics(db, route.id)
            calculate_route_cost(db, route.id)

        db.commit()
        print("Database seeded successfully with Demo Data (BE-B)!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
