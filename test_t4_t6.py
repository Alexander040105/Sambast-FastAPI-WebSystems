import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from backend.app.main import app
from backend.app.db.session import SessionLocal, Base, engine

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200

def test_dispatch_queue():
    # Attempt to get queue without auth (should fail)
    response = client.get("/api/v1/dispatch/queue")
    assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"

if __name__ == "__main__":
    test_health()
    print("Tests passed!")
