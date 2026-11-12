from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Trip(Base):
    __tablename__ = "trips"

    trip_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    route_id: Mapped[int] = mapped_column(
        ForeignKey("routes.route_id")
    )

    departure_time: Mapped[datetime] = mapped_column(DateTime)
    arrival_time: Mapped[datetime] = mapped_column(DateTime)

    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    status: Mapped[str] = mapped_column(String(20))