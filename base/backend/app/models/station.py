from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Station(Base):
    __tablename__ = "stations"

    station_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String(150))
    city: Mapped[str] = mapped_column(String(100))
    address: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(20))

    is_active: Mapped[bool] = mapped_column(Boolean)
    created_at: Mapped[DateTime] = mapped_column(DateTime)
    updated_at: Mapped[DateTime] = mapped_column(DateTime)