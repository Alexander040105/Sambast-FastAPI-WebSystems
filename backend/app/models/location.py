"""locations — geocoded addresses."""

from sqlalchemy import (
    BigInteger, Column, DateTime, Numeric, String, Text, func,
)

from app.db.session import Base


class Location(Base):
    __tablename__ = "locations"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    label = Column(String(255), nullable=True)
    line1 = Column(String(255), nullable=False)
    line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    province = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    lat = Column(Numeric(10, 7), nullable=True)
    lng = Column(Numeric(10, 7), nullable=True)
    place_id = Column(Text, nullable=True, comment="Nominatim place_id")
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
