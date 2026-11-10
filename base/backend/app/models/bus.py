from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Enum, func
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.db.session import Base


class BusStatusEnum(str, enum.Enum):
    active = "active"
    maintenance = "maintenance"
    retired = "retired"


class Bus(Base):
    __tablename__ = "buses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    plate_number: Mapped[str] = mapped_column(String(20), unique=True)
    bus_type_id: Mapped[int] = mapped_column(ForeignKey("bus_types.id"))
    status: Mapped[BusStatusEnum] = mapped_column(
        Enum(BusStatusEnum), default=BusStatusEnum.active
    )
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )