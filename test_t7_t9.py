import os
import sys
import pytest
from fastapi.testclient import TestClient

from dotenv import load_dotenv
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "backend", ".env")))

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

from app.main import app
from app.db.session import SessionLocal

client = TestClient(app)

def test_imports():
    assert True

from unittest.mock import AsyncMock
from app.routers.fleet import sse_event_stream

@pytest.mark.anyio
async def test_fleet_stream_generator():
    req = AsyncMock()
    req.is_disconnected = AsyncMock(return_value=False)
    gen = sse_event_stream(req)
    first_event = await anext(gen)
    assert "event: connected" in first_event
    await gen.aclose()


