from typing import Optional

from pydantic import BaseModel, Field


class PaymentCreate(BaseModel):
    """POST /payments — staff record a payment against an order."""
    order_no: str = Field(..., min_length=1)
    method: str = Field(default="cash", max_length=20)
    reference: Optional[str] = Field(default=None, max_length=100)

    @property
    def normalized_method(self) -> str:
        return self.method.strip().lower()
