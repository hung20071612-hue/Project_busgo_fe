from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, unique=True)

    trips: Mapped[list["Trip"]] = relationship(back_populates="driver")
