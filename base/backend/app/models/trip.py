from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import CheckConstraint, DateTime, Enum as SqlEnum, ForeignKey, Index, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class TripStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    DEPARTED = "DEPARTED"
    CANCELLED = "CANCELLED"


class Trip(Base):
    __tablename__ = "trips"
    __table_args__ = (
        CheckConstraint("arrival_at > departure_at", name="chk_trips_times"),
        CheckConstraint("ticket_price >= 0", name="chk_trips_price"),
        Index("idx_trips_departure_status", "departure_at", "status"),
        Index("idx_trips_route_departure", "route_id", "departure_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), nullable=False)
    bus_id: Mapped[int] = mapped_column(ForeignKey("buses.id"), nullable=False)
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"), nullable=False)
    departure_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    arrival_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ticket_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[TripStatus] = mapped_column(
        SqlEnum(
            TripStatus,
            native_enum=True,
            values_callable=lambda enum: [item.value for item in enum],
        ),
        nullable=False,
        default=TripStatus.SCHEDULED,
        server_default=TripStatus.SCHEDULED.value,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    route: Mapped["Route"] = relationship(back_populates="trips")
    bus: Mapped["Bus"] = relationship(back_populates="trips")
    driver: Mapped["Driver"] = relationship(back_populates="trips")
    bookings: Mapped[list["Booking"]] = relationship(back_populates="trip")
