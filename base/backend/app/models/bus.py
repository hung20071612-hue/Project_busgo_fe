from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Bus(Base):
    __tablename__ = "buses"
    __table_args__ = (CheckConstraint("seat_count > 0", name="chk_buses_seat_count"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    license_plate: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    seat_count: Mapped[int] = mapped_column(nullable=False)

    trips: Mapped[list["Trip"]] = relationship(back_populates="bus")
