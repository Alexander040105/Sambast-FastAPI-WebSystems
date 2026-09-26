"""
services/notifications.py — status-change emails + notification log (BE-A T8).

Every status change worth telling the customer about goes through
notify_order_status(): it writes a `notifications` row and tries to send
the email. A failed SMTP call marks the row 'failed' instead of breaking
the request — the order flow must not die because Gmail is down.

BE-B's delivery lifecycle endpoints (arrive/complete/fail/pod) should call
this same function when they transition a delivery.
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.notification import Notification
from app.models.order import Order
from app.services.email import send_email


def notify_order_status(
    db: Session,
    order: Order,
    new_status: str,
    note: Optional[str] = None,
) -> Notification:
    """Email the customer that order.order_no moved to new_status, and log
    it in the notifications table. Always returns the log row."""
    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()

    subject = f"Sambast order {order.order_no} — {new_status}"
    body_lines = [
        f"Hi {customer.name or 'there'},",
        "",
        f"Your order {order.order_no} is now {new_status}.",
    ]
    if note:
        body_lines.append(f"Note: {note}")
    body_lines += [
        "",
        f"Order total: PHP {order.total_price}",
        "",
        "Track it live on your Sambast account.",
    ]
    body = "\n".join(body_lines)

    notification = Notification(
        customer_id=order.customer_id,
        channel="email",
        template=f"order_{str(new_status).lower()}",
        payload={
            "order_no": order.order_no,
            "status": new_status,
            "note": note,
            "to": customer.email if customer else None,
        },
        status="pending",
    )

    try:
        if not customer or not customer.email:
            raise RuntimeError("Customer has no email address")
        send_email(customer.email, subject, body)
        notification.status = "sent"
        notification.sent_at = datetime.now(timezone.utc)
    except Exception as exc:
        notification.status = "failed"
        notification.payload = {
            **notification.payload,
            "error": str(exc),
        }

    db.add(notification)
    db.flush()
    return notification
