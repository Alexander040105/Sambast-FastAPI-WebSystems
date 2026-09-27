"""
services/sse.py — In-memory SSE event broadcaster for delivery and fleet tracking.

MEGAPLAN §7.2:
Shape: {event: "status", data: {delivery_id, order_no, status, lat, lng, ts}}
"""

import asyncio
from datetime import datetime, timezone
from typing import Set, Dict, Any, Optional


class SSEBroadcaster:
    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)

    def emit(
        self,
        delivery_id: int,
        order_no: Optional[str],
        status: str,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        note: Optional[str] = None,
    ) -> None:
        payload = {
            "delivery_id": delivery_id,
            "order_no": order_no or "",
            "status": status,
            "lat": lat,
            "lng": lng,
            "note": note,
            "ts": datetime.now(timezone.utc).isoformat(),
        }
        for q in list(self._subscribers):
            try:
                q.put_nowait(payload)
            except Exception:
                pass


broadcaster = SSEBroadcaster()
