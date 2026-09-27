"""
services/geocoding.py — Nominatim lookup + manual lat/lng override.

BE-B T3: geocode an address string using the free OSM Nominatim API.
Falls back gracefully when offline or rate-limited.
"""

from typing import Optional
import httpx

from app.core.config import settings

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"


METRO_MANILA_PRESETS = [
    ("makati", 14.5547, 121.0244),
    ("taguig", 14.5409, 121.0503),
    ("bgc", 14.5409, 121.0503),
    ("quezon city", 14.6178, 121.0572),
    ("araneta", 14.6178, 121.0572),
    ("pasig", 14.5833, 121.0583),
    ("ortigas", 14.5833, 121.0583),
    ("mandaluyong", 14.5838, 121.0566),
    ("manila", 14.5818, 120.9770),
    ("pasay", 14.5350, 120.9822),
    ("san juan", 14.6042, 121.0333),
    ("greenhills", 14.6042, 121.0333),
    ("muntinlupa", 14.4253, 121.0267),
    ("alabang", 14.4253, 121.0267),
    ("paranaque", 14.4446, 121.0182),
    ("bf homes", 14.4446, 121.0182),
    ("marikina", 14.6507, 121.1029),
    ("caloocan", 14.6571, 120.9841),
    ("las pinas", 14.4445, 120.9939),
]


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
        pass  # fall through to preset fallback

    # MEGAPLAN §12 Fallback: Preset-zone coordinates for Metro Manila
    query_lower = query.lower()
    for key, lat, lng in METRO_MANILA_PRESETS:
        if key in query_lower:
            return {
                "lat": lat,
                "lng": lng,
                "place_id": f"preset_{key}",
                "display_name": f"{query} (Preset Zone)",
            }

    # Default Metro Manila center fallback if city/barangay mentioned
    if "metro manila" in query_lower or "philippines" in query_lower:
        return {
            "lat": 14.5547,
            "lng": 121.0244,
            "place_id": "preset_ncr_center",
            "display_name": f"{query} (Metro Manila Center)",
        }

    return {"lat": None, "lng": None, "place_id": None, "display_name": query}

