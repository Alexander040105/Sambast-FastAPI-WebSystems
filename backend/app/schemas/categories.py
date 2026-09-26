from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.products import UnitOption


class CategoryCreate(BaseModel):
    """Payload for POST /categories."""
    name: str = Field(..., min_length=1, max_length=255)
    unit_options: Optional[List[UnitOption]] = None


class CategoryUpdate(BaseModel):
    """Payload for PATCH /categories/{id} — every field optional."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    unit_options: Optional[List[UnitOption]] = None


class CategoryOut(BaseModel):
    """Response schema for category endpoints."""
    id: int
    name: str
    unit_options: Optional[List[UnitOption]] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
