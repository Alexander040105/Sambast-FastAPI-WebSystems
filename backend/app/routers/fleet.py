"""
routers/fleet.py — Realtime fleet tracking via Server-Sent Events (SSE).
"""

import json
import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.services.sse import broadcaster

router = APIRouter(prefix="/fleet", tags=["Fleet Tracking"])


async def sse_event_stream(request: Request):
    q = broadcaster.subscribe()
    try:
        yield f"event: connected\ndata: {json.dumps({'message': 'Connected to fleet stream'})}\n\n"
        while True:
            if await request.is_disconnected():
                break
            try:
                event_data = await asyncio.wait_for(q.get(), timeout=15.0)
                yield f"event: status\ndata: {json.dumps(event_data)}\n\n"
            except asyncio.TimeoutError:
                yield ": keep-alive\n\n"
    finally:
        broadcaster.unsubscribe(q)


@router.get("/stream")
async def fleet_stream(request: Request):
    return StreamingResponse(
        sse_event_stream(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
