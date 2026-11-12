from datetime import date, datetime
from sqlalchemy import String, Date, DateTime, Enum, func
from sqlalchemy.orm import Mapped, mapped_column
import enum
from sqlalchemy.orm import relationship

from app.db.session import Base


class DriverStatusEnum(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    on_leave = "on_leave"


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str] = mapped_column(String(20))
    license_no: Mapped[str] = mapped_column(String(50), unique=True)
    license_class: Mapped[str | None] = mapped_column(String(10), nullable=True)
    status: Mapped[DriverStatusEnum] = mapped_column(
        Enum(DriverStatusEnum), default=DriverStatusEnum.active
    )
    hired_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
    trips = relationship("Trip", back_populates="driver")