"""Models: Dat ve, giu ghe va thanh toan. Bang: bookings, booking_details, payments.
"""
import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime, Enum, ForeignKey, Numeric, String, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class BookingStatus(str, enum.Enum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    PAID = "PAID"
    CANCELLED = "CANCELLED"


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    TRANSFER = "TRANSFER"
    WALLET = "WALLET"


class PaymentStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    REFUNDED = "REFUNDED"


class Booking(Base):
    """Don dat ve."""

    __tablename__ = "bookings"

    booking_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_code: Mapped[str] = mapped_column(String(20), unique=True)
    # Kieu String(5) khop voi user.id trong ERD chung; doi thanh int neu nhom doi user.id sang INT
    user_id: Mapped[str] = mapped_column(String(5), ForeignKey("user.id"), index=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.trip_id"), index=True)
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus), default=BookingStatus.PENDING_PAYMENT, index=True
    )
    refund_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    details: Mapped[list["BookingDetail"]] = relationship(
        back_populates="booking", cascade="all, delete-orphan"
    )
    payments: Mapped[list["Payment"]] = relationship(back_populates="booking")


class BookingDetail(Base):
    """Tung ghe cua don. hold_until = han giu ghe (NULL khi da thanh toan)."""

    __tablename__ = "booking_details"
    # Chong 2 nguoi cung dat 1 ghe cua 1 chuyen
    __table_args__ = (UniqueConstraint("trip_id", "seat_id", name="uq_trip_seat"),)

    detail_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.booking_id", ondelete="CASCADE"), index=True
    )
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.trip_id"))
    seat_id: Mapped[int] = mapped_column(ForeignKey("seats.seat_id"))
    passenger_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    passenger_phone: Mapped[str | None] = mapped_column(String(15), nullable=True)
    pickup: Mapped[str | None] = mapped_column(String(255), nullable=True)
    dropoff: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hold_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)

    booking: Mapped["Booking"] = relationship(back_populates="details")


class Payment(Base):
    """Thanh toan gia lap."""

    __tablename__ = "payments"

    payment_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.booking_id"), index=True)
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.SUCCESS
    )
    paid_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    booking: Mapped["Booking"] = relationship(back_populates="payments")