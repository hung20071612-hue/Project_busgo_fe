from decimal import Decimal

from sqlalchemy import Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Route(Base):
    __tablename__ = "routes"
    __table_args__ = (Index("idx_routes_search", "origin", "destination"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    origin: Mapped[str] = mapped_column(String(120), nullable=False)
    destination: Mapped[str] = mapped_column(String(120), nullable=False)
    distance_km: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)

    trips: Mapped[list["Trip"]] = relationship(back_populates="route")
