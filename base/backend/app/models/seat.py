from sqlalchemy import Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Seat(Base):
    __tablename__ = "seats"

    seat_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    bus_type_id: Mapped[int] = mapped_column(
        ForeignKey("bus_types.bus_type_id")
    )

    floor: Mapped[int] = mapped_column(Integer)
    row_num: Mapped[int] = mapped_column(Integer)
    col_num: Mapped[int] = mapped_column(Integer)

    seat_code: Mapped[str] = mapped_column(String(10))
    seat_type: Mapped[str] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean)