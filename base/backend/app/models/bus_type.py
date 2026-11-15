from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, Enum, func
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.db.session import Base


class SeatTypeEnum(str, enum.Enum):
    seat = "seat"
    berth = "berth"


class BusType(Base):
    __tablename__ = "bus_types"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    floors: Mapped[int] = mapped_column(Integer, default=1)
    rows_per_floor: Mapped[int] = mapped_column(Integer)
    cols_per_floor: Mapped[int] = mapped_column(Integer)
    seat_type: Mapped[SeatTypeEnum] = mapped_column(
        Enum(SeatTypeEnum), default=SeatTypeEnum.seat
    )
    total_seats: Mapped[int] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )