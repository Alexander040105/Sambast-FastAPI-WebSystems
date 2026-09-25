"""proof_of_delivery — photo/signature captured at delivery."""

from sqlalchemy import (
    BigInteger, Column, DateTime, ForeignKey, Numeric, String, Text, func,
)

from app.db.session import Base


class ProofOfDelivery(Base):
    __tablename__ = "proof_of_delivery"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    delivery_id = Column(
        BigInteger, ForeignKey("deliveries.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    type = Column(
        String(20), nullable=False, default="photo",
        comment="photo|signature|otp",
    )
    file_url = Column(Text, nullable=True)
    recipient_name = Column(String(255), nullable=True)
    captured_at = Column(DateTime(timezone=True), nullable=True)
    lat = Column(Numeric(10, 7), nullable=True)
    lng = Column(Numeric(10, 7), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
