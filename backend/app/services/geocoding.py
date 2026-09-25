"""
services/geocoding.py — Nominatim lookup + manual lat/lng override.

BE-B T3: geocode an address string using the free OSM Nominatim API.
Falls back gracefully when offline or rate-limited.
"""

from typing import Optional
import httpx

from app.core.config import settings

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"


async def geocode_address(
    query: str,
    *,
    manual_lat: Optional[float] = None,
    manual_lng: Optional[float] = None,
) -> dict:
    """
    Return ``{lat, lng, place_id, display_name}`` for a free-text address.

    Priority:
    1. If *manual_lat* and *manual_lng* are provided, use them directly
       (manual override per MEGAPLAN §2).
    2. Otherwise, hit Nominatim.
    3. On any failure, return ``{lat: None, lng: None}``.
    """
    if manual_lat is not None and manual_lng is not None:
        return {
            "lat": manual_lat,
            "lng": manual_lng,
            "place_id": None,
            "display_name": query,
        }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                NOMINATIM_SEARCH_URL,
                params={
                    "q": query,
                    "format": "jsonv2",
                    "limit": 1,
                    "addressdetails": 1,
                },
                headers={"User-Agent": settings.NOMINATIM_USER_AGENT},
            )
            resp.raise_for_status()
            results = resp.json()
            if results:
                hit = results[0]
                return {
                    "lat": float(hit["lat"]),
                    "lng": float(hit["lon"]),
                    "place_id": str(hit.get("place_id", "")),
                    "display_name": hit.get("display_name", query),
                }
    except Exception:
        pass  # fall through to default

    return {"lat": None, "lng": None, "place_id": None, "display_name": query}
