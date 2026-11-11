from datetime import datetime
from enum import Enum

from sqlalchemy import CheckConstraint, DateTime, Enum as SqlEnum, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class BookingStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        CheckConstraint("seat_count > 0", name="chk_bookings_seats"),
        Index("idx_bookings_trip_status", "trip_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), nullable=False)
    seat_count: Mapped[int] = mapped_column(nullable=False)
    status: Mapped[BookingStatus] = mapped_column(
        SqlEnum(
            BookingStatus,
            native_enum=True,
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
        default=BookingStatus.CONFIRMED,
        server_default=BookingStatus.CONFIRMED.value,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    trip: Mapped["Trip"] = relationship(back_populates="bookings")
