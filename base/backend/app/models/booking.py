from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Booking(Base):
    __tablename__ = "bookings"

    booking_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(
        String(5), ForeignKey("user.user_id")
    )

    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.trip_id")
    )

    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    status: Mapped[str] = mapped_column(
        Enum("holding", "paid", "cancelled", "expired")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now()
    )