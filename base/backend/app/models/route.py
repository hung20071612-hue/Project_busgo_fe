from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(20), unique=True, nullable=False)
    departure_id = Column(Integer, ForeignKey("stations.id"), nullable=False)
    arrival_id = Column(Integer, ForeignKey("stations.id"), nullable=False)
    distance_km = Column(Numeric(8, 2), nullable=False)
    estimated_time = Column(Integer, nullable=False)  # phút
    base_price = Column(Numeric(12, 2), default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    trips = relationship("Trip", back_populates="route")