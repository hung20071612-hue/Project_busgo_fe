from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base


class BookingDetail(Base):
    __tablename__ = "booking_details"

    booking_detail_id: Mapped[int] = mapped_column(
        primary_key=True, autoincrement=True
    )

    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.booking_id")
    )

    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.trip_id")
    )

    seat_id: Mapped[int] = mapped_column(
        ForeignKey("seats.seat_id")
    )

    passenger_name: Mapped[str] = mapped_column(String(100))
    passenger_phone: Mapped[str] = mapped_column(String(15))

    pick_up: Mapped[str] = mapped_column(String(255))
    dropoff: Mapped[str] = mapped_column(String(255))

    hold_until: Mapped[datetime] = mapped_column(DateTime)