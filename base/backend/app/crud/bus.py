from math import ceil
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.bus import Bus
from app.models.trip import Trip
from app.schemas.bus import BusCreate, BusUpdate


def get_buses(
    db: Session,
    keyword: str | None = None,
    status: str | None = None,
    page: int = 1,
    size: int = 10,
):
    query = select(Bus)
    if keyword:
        query = query.where(Bus.plate_number.contains(keyword))
    if status:
        query = query.where(Bus.status == status)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = list(
        db.scalars(
            query.order_by(Bus.id.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": ceil(total / size) if size else 0,
    }


def get_bus(db: Session, bus_id: int) -> Bus | None:
    return db.get(Bus, bus_id)


def create_bus(db: Session, data: BusCreate) -> Bus:
    # Biển số không trùng
    existing = db.scalar(select(Bus).where(Bus.plate_number == data.plate_number))
    if existing:
        raise HTTPException(status_code=400, detail="Biển số xe đã tồn tại")

    bus = Bus(**data.model_dump())
    db.add(bus)
    db.commit()
    db.refresh(bus)
    return bus


def update_bus(db: Session, bus: Bus, data: BusUpdate) -> Bus:
    update_data = data.model_dump(exclude_unset=True)

    if "plate_number" in update_data:
        existing = db.scalar(
            select(Bus).where(
                Bus.plate_number == update_data["plate_number"],
                Bus.id != bus.id,
            )
        )
        if existing:
            raise HTTPException(status_code=400, detail="Biển số xe đã tồn tại")

    for field, value in update_data.items():
        setattr(bus, field, value)

    db.commit()
    db.refresh(bus)
    return bus


def delete_bus(db: Session, bus: Bus) -> dict:
    """Xe đã có chuyến → chuyển sang maintenance; chưa có → xóa cứng."""
    has_trips = db.scalar(select(Trip.id).where(Trip.bus_id == bus.id).limit(1))

    if has_trips:
        bus.status = "maintenance"
        db.commit()
        return {
            "action": "deactivated",
            "message": "Xe đã có chuyến, đã chuyển sang trạng thái bảo dưỡng",
        }

    db.delete(bus)
    db.commit()
    return {"action": "deleted", "message": "Đã xóa xe"}