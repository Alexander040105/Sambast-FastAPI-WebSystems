"""
/api/v1/payments — COD payment recording.

POST /payments marks an order's payment as paid (staff collect cash on
delivery — admin/dispatcher only). GET /payments/{id} returns the row;
customers can only see payments on their own orders.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.core.errors import api_error
from app.db.session import get_db
from app.models.order import Order
from app.models.payment import Payment
from app.models.user import User
from app.schemas.orders import PaymentOut
from app.schemas.payments import PaymentCreate

router = APIRouter(prefix="/payments", tags=["payments"])

ALLOWED_METHODS = ("cash", "gcash", "bank_transfer")


@router.post("", response_model=PaymentOut, status_code=200)
def record_payment(
    body: PaymentCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role("admin", "dispatcher")),
):
    method = body.normalized_method
    if method not in ALLOWED_METHODS:
        raise api_error(
            422, "VALIDATION_ERROR",
            f"method must be one of: {', '.join(ALLOWED_METHODS)}",
        )

    order = db.query(Order).filter(Order.order_no == body.order_no).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    payment = db.query(Payment).filter(Payment.order_id == order.id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Order has no payment record")
    if payment.status == "paid":
        raise api_error(409, "CONFLICT", "Order is already paid.")

    payment.method = method
    payment.status = "paid"
    payment.reference = body.reference
    payment.paid_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(payment)
    return payment


@router.get("/{payment_id}", response_model=PaymentOut)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # customers may only see payments attached to their own orders
    if getattr(user, "role", None) == "customer":
        order = db.query(Order).filter(Order.id == payment.order_id).first()
        if not order or order.customer_id != user.id:
            raise HTTPException(status_code=404, detail="Payment not found")

    return payment
