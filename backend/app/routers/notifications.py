"""
/api/v1/notifications — the customer-facing notification log + an admin
test-send used to verify SMTP wiring (BE-A T8).
"""

import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.core.errors import api_error
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.fleet import Pagination
from app.schemas.notifications import NotificationOut, TestNotificationRequest
from app.services.email import send_email

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=dict)
def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    query = db.query(Notification)
    if getattr(user, "role", None) == "customer":
        query = query.filter(Notification.customer_id == user.id)
    else:
        query = query.filter(Notification.user_id == user.id)
    query = query.order_by(Notification.created_at.desc())

    total_items = query.count()
    total_pages = max(1, math.ceil(total_items / page_size))
    rows = query.offset((page - 1) * page_size).limit(page_size).all()

    data = []
    for row in rows:
        data.append(NotificationOut.model_validate(row).model_dump())

    return {
        "data": data,
        "pagination": Pagination(
            page=page,
            page_size=page_size,
            total_items=total_items,
            total_pages=total_pages,
        ).model_dump(),
    }


@router.post("/test", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
def send_test_notification(
    body: TestNotificationRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    notification = Notification(
        user_id=user.id,
        channel="email",
        template="admin_test",
        payload={"to": body.recipient_email, "message": body.message},
        status="pending",
    )

    try:
        send_email(
            body.recipient_email,
            "Sambast notification test",
            body.message or "SMTP is wired up — this is a test email.",
        )
        notification.status = "sent"
        notification.sent_at = datetime.now(timezone.utc)
    except Exception as exc:
        notification.status = "failed"
        notification.payload = {
            **(notification.payload or {}),
            "error": str(exc),
        }
        db.add(notification)
        db.commit()
        db.refresh(notification)
        raise api_error(
            503, "EMAIL_SEND_FAILED",
            "Could not send the test email.",
            details={"notification_id": notification.id},
        )

    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification
