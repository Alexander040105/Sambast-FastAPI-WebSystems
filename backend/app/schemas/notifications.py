from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class NotificationOut(BaseModel):
    id: int
    channel: str
    template: Optional[str] = None
    payload: Optional[dict] = None
    status: str
    sent_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TestNotificationRequest(BaseModel):
    """POST /notifications/test — admin only."""
    recipient_email: str = Field(..., min_length=3)
    message: Optional[str] = None
