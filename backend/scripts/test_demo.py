import os
import sys
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
import requests
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app.db.session import SessionLocal, engine
from app.models.user import User
from app.models.driver import Driver
from app.models.order import Order
from app.core.security import create_access_token

def get_token(db, role="dispatcher"):
    user = db.query(User).filter(User.role == role).first()
    if not user:
        print(f"No user with role {role} found")
        return None
    token = create_access_token(sub=user.id, role=user.role)
    return token

def run_demo():
    print("Starting Demo Rehearsal...")
    db = SessionLocal()
    
    dispatch_token = get_token(db, "dispatcher")
    driver_token = get_token(db, "driver")
    
    if not dispatch_token or not driver_token:
        print("Missing tokens, aborting.")
        return
        
    headers_dispatch = {"Authorization": f"Bearer {dispatch_token}"}
    headers_driver = {"Authorization": f"Bearer {driver_token}"}
    
    BASE_URL = "http://127.0.0.1:8000/api/v1"

    # Check if live server is reachable, otherwise fall back to TestClient
    try:
        r = requests.get("http://127.0.0.1:8000/health", timeout=0.5)
        use_live = (r.status_code == 200)
    except Exception:
        use_live = False

    if not use_live:
        print("Live server on :8000 not running. Using FastAPI TestClient for in-memory rehearsal...")
        from fastapi.testclient import TestClient
        from app.main import app
        tc = TestClient(app)

        class ClientWrapper:
            def get(self, url, headers=None, **kwargs):
                path = url.replace("http://127.0.0.1:8000", "")
                return tc.get(path, headers=headers, **kwargs)
            def post(self, url, headers=None, json=None, **kwargs):
                path = url.replace("http://127.0.0.1:8000", "")
                return tc.post(path, headers=headers, json=json, **kwargs)
            def patch(self, url, headers=None, json=None, **kwargs):
                path = url.replace("http://127.0.0.1:8000", "")
                return tc.patch(path, headers=headers, json=json, **kwargs)

        http_client = ClientWrapper()
    else:
        print("Live server on :8000 detected. Running rehearsal over HTTP...")
        http_client = requests
    
    print("\n--- 1. Dispatch Queue ---")
    resp = http_client.get(f"{BASE_URL}/dispatch/queue", headers=headers_dispatch)
    print(f"GET /dispatch/queue: {resp.status_code}")
    if resp.status_code == 200:
        orders = resp.json()
        print(f"Orders in queue: {len(orders['data'])}")
        
        if not orders['data']:
            print("No orders in queue, aborting.")
            return
            
        order_id = orders['data'][0]['id']
        
        print(f"\n--- 2. Auto-assign ---")
        resp = http_client.post(f"{BASE_URL}/dispatch/auto-assign", headers=headers_dispatch, json={"order_id": order_id})
        print(f"POST /dispatch/auto-assign: {resp.status_code}")
        recommended_driver_id = None
        if resp.status_code == 200:
            rec_data = resp.json()
            print("Auto-assign successful:", rec_data)
            recommended_driver_id = rec_data.get("driver_id")
        else:
            print("Auto-assign failed:", resp.text)

        driver_user = db.query(User).filter(User.role == "driver").first()
        driver_profile = db.query(Driver).filter(Driver.user_id == driver_user.id).first() if driver_user else None
        if not driver_profile:
            print("Driver not found.")
            return

        target_driver_id = recommended_driver_id or driver_profile.id

        print(f"\n--- 2b. Assign Order to Driver ---")
        assign_resp = http_client.post(
            f"{BASE_URL}/dispatch/orders/{order_id}/assign",
            headers=headers_dispatch,
            json={"driver_id": target_driver_id},
        )
        print(f"POST /dispatch/orders/{order_id}/assign: {assign_resp.status_code}")

        target_driver = db.query(Driver).filter(Driver.id == target_driver_id).first()
        if target_driver:
            assigned_token = create_access_token(sub=target_driver.user_id, role="driver")
            headers_driver = {"Authorization": f"Bearer {assigned_token}"}

        print(f"\n--- 3. Create Route ---")
        resp = http_client.post(f"{BASE_URL}/routes", headers=headers_dispatch, json={"driver_id": target_driver_id})
        print(f"POST /routes: {resp.status_code}")
        if resp.status_code in [200, 201]:
            route = resp.json()
            route_id = route['id']
            print("Route built:", route_id)
            
            print(f"\n--- 4. Optimize Route ---")
            resp = http_client.post(f"{BASE_URL}/routes/{route_id}/optimize", headers=headers_dispatch)
            print(f"POST /routes/{route_id}/optimize: {resp.status_code}")
            print("Optimize response:", resp.json())
            
            print(f"\n--- 5. Driver Manifest ---")
            resp = http_client.get(f"{BASE_URL}/me/route", headers=headers_driver)
            print(f"GET /me/route: {resp.status_code}")
            
            if resp.status_code == 200:
                manifest = resp.json()
                print("Manifest:", manifest)
                
                # Check for stops
                resp = http_client.get(f"{BASE_URL}/routes/{route_id}", headers=headers_dispatch)
                if resp.status_code == 200:
                    route_details = resp.json()
                    stops = route_details.get("stops", [])
                    if stops:
                        stop_id = stops[0]['id']
                        delivery_id = stops[0]['delivery_id']
                        
                        print(f"\n--- 6. Stop: Arrive ---")
                        resp = http_client.post(f"{BASE_URL}/stops/{stop_id}/arrive", headers=headers_driver)
                        print(f"POST /stops/{stop_id}/arrive: {resp.status_code} - {resp.text}")
                        
                        print(f"\n--- 7. Stop: Complete ---")
                        # We need POD
                        pod_data = {
                            "recipient_name": "John Doe",
                            "notes": "Left at door",
                            "lat": 14.6,
                            "lng": 121.0,
                            "signature_url": "http://example.com/sig.png",
                            "photo_url": "http://example.com/photo.png"
                        }
                        resp = http_client.post(f"{BASE_URL}/deliveries/{delivery_id}/pod", headers=headers_driver, json=pod_data)
                        print(f"POST /deliveries/{delivery_id}/pod: {resp.status_code} - {resp.text}")
                        
                        resp = http_client.post(f"{BASE_URL}/stops/{stop_id}/complete", headers=headers_driver)
                        print(f"POST /stops/{stop_id}/complete: {resp.status_code} - {resp.text}")
                    else:
                        print("No stops found in route.")
                else:
                    print("Could not get route details:", resp.text)
        else:
            print("Failed to build route:", resp.text)
            
    print("\n--- 8. Ops Analytics ---")
    resp = http_client.get(f"{BASE_URL}/analytics/driver-performance", headers=headers_dispatch)
    print(f"GET /analytics/driver-performance: {resp.status_code} - {resp.text[:100]}")
    resp = http_client.get(f"{BASE_URL}/analytics/delivery-costs", headers=headers_dispatch)
    print(f"GET /analytics/delivery-costs: {resp.status_code} - {resp.text[:100]}")
    resp = http_client.get(f"{BASE_URL}/analytics/failed-deliveries", headers=headers_dispatch)
    print(f"GET /analytics/failed-deliveries: {resp.status_code} - {resp.text[:100]}")

if __name__ == "__main__":
    run_demo()
