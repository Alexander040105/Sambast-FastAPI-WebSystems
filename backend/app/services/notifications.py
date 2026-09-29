"""
services/notifications.py — status-change emails + notification log (BE-A T8).

Every status change worth telling the customer about goes through
notify_order_status(): it writes a `notifications` row in the caller's
transaction, then sends the email on a daemon thread so a slow or down
SMTP server can't stall the request or stretch an open DB transaction
(Neon drops connections that idle mid-transaction). The worker marks the
row 'sent' or 'failed' with the error in its payload.

BE-B's delivery lifecycle endpoints (arrive/complete/fail/pod) call
this same function when they transition a delivery.
"""

import threading
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.notification import Notification
from app.models.order import Order


def _send_and_update(notification_id: int, recipient: str, subject: str,
                     body: str) -> None:
    """Worker: send the email, then update the log row with the result.
    Runs on its own session — never shares the request's connection.

    The row is flushed but not yet committed when the thread starts, so
    poll until it becomes visible. If the caller's transaction rolls
    back, the row never appears and no email is sent — which is correct:
    a rolled-back status change shouldn't notify anyone."""
    import time

    from app.db.session import SessionLocal
    from app.services.email import send_email

    db = SessionLocal()
    try:
        notification = None
        for _ in range(20):
            notification = db.query(Notification).filter(
                Notification.id == notification_id
            ).first()
            if notification:
                break
            time.sleep(0.5)
        if not notification:
            return
        try:
            send_email(recipient, subject, body)
            notification.status = "sent"
            notification.sent_at = datetime.now(timezone.utc)
        except Exception as exc:
            notification.status = "failed"
            notification.payload = {**notification.payload, "error": str(exc)}
        db.commit()
    finally:
        db.close()


def notify_order_status(
    db: Session,
    order: Order,
    new_status: str,
    note: Optional[str] = None,
) -> Notification:
    """Log a customer notification row for order.order_no -> new_status
    (committed with the caller's transaction) and queue the email on a
    background thread. Always returns the log row."""
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
    db.add(notification)
    db.flush()

    if not customer or not customer.email:
        notification.status = "failed"
        notification.payload = {
            **notification.payload,
            "error": "Customer has no email address",
        }
        return notification

    threading.Thread(
        target=_send_and_update,
        args=(notification.id, customer.email, subject, body),
        daemon=True,
    ).start()

    return notification
