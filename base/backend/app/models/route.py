from decimal import Decimal
from sqlalchemy import Column, Integer, String, Numeric, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Route(Base):
    __tablename__ = "routes"

    route_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    departure_id: Mapped[int] = mapped_column(ForeignKey("stations.station_id"))
    arrival_id: Mapped[int] = mapped_column(ForeignKey("stations.station_id"))

    code: Mapped[str] = mapped_column(String(20))
    distance_km: Mapped[Decimal] = mapped_column(Numeric(8, 2))
    estimated_time: Mapped[int] = mapped_column(Integer)
    base_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    is_active: Mapped[bool] = mapped_column(Boolean)
    created_at = mapped_column(DateTime)
    updated_at = mapped_column(DateTime)