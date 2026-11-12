from sqlalchemy import String, Integer, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class BusType(Base):
    __tablename__ = "bus_types"

    bus_type_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String(100))
    seat_type: Mapped[str] = mapped_column(String(20))
    total_seats: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(String(255))

    is_active: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[DateTime] = mapped_column(DateTime)
    updated_at: Mapped[DateTime] = mapped_column(DateTime)