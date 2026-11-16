from sqlalchemy import String, Integer, Boolean, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.db.session import Base


class SeatTypeEnum(str, enum.Enum):
    seat = "seat"
    berth = "berth"


class Seat(Base):
    __tablename__ = "seats"
    __table_args__ = (
        UniqueConstraint("bus_type_id", "seat_code", name="uk_seat_code_per_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    bus_type_id: Mapped[int] = mapped_column(ForeignKey("bus_types.id", ondelete="CASCADE"))
    floor: Mapped[int] = mapped_column(Integer, default=1)
    row_num: Mapped[int] = mapped_column(Integer)
    col_num: Mapped[int] = mapped_column(Integer)
    seat_code: Mapped[str] = mapped_column(String(10))
    seat_type: Mapped[SeatTypeEnum] = mapped_column(
        Enum(SeatTypeEnum), default=SeatTypeEnum.seat
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)