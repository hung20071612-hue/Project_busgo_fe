from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Payment(Base):
    __tablename__ = "payments"

    payment_id: Mapped[int] = mapped_column(
        primary_key=True, autoincrement=True
    )

    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.booking_id")
    )

    method: Mapped[str] = mapped_column(
        Enum("cash", "bank_transfer", "wallet")
    )

    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    status: Mapped[str] = mapped_column(
        Enum("pending", "successful", "failed", "refunded")
    )

    paid_at: Mapped[datetime] = mapped_column(DateTime)