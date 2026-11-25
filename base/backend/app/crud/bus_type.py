from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.bus import Bus
from app.models.bus_type import BusType
from app.models.seat import Seat
from app.models.trip import Trip
from app.schemas.bus_type import BusTypeCreate, BusTypeUpdate


def _generate_seats(bus_type: BusType) -> list[Seat]:
    seats = []
    cols = bus_type.cols_per_floor
    rows = bus_type.rows_per_floor
    floors = bus_type.floors

    for floor in range(1, floors + 1):
        for row in range(1, rows + 1):
            for col in range(1, cols + 1):
                col_letter = chr(64 + col)
                if floors > 1:
                    seat_code = f"{floor}{col_letter}{row:02d}"
                else:
                    seat_code = f"{col_letter}{row:02d}"

                seats.append(
                    Seat(
                        bus_type_id=bus_type.id,
                        floor=floor,
                        row_num=row,
                        col_num=col,
                        seat_code=seat_code,
                        seat_type=bus_type.seat_type,
                        is_active=True,
                    )
                )
    return seats


def _has_trips_using_bus_type(db: Session, bus_type_id: int) -> bool:
    return (
        db.scalar(
            select(Trip.id)
            .join(Bus, Trip.bus_id == Bus.id)
            .where(Bus.bus_type_id == bus_type_id)
            .limit(1)
        )
        is not None
    )


def get_bus_types(db: Session, keyword: str | None = None, active_only: bool = False):
    query = select(BusType).order_by(BusType.id.desc())
    if keyword:
        query = query.where(BusType.name.contains(keyword))
    if active_only:
        query = query.where(BusType.is_active == True)
    return list(db.scalars(query))


def get_bus_type(db: Session, bus_type_id: int) -> BusType | None:
    return db.get(BusType, bus_type_id)


def get_seats_of_bus_type(db: Session, bus_type_id: int) -> list[Seat]:
    return list(
        db.scalars(
            select(Seat)
            .where(Seat.bus_type_id == bus_type_id)
            .order_by(Seat.floor, Seat.row_num, Seat.col_num)
        )
    )


def create_bus_type(db: Session, data: BusTypeCreate) -> BusType:
    total_seats = data.floors * data.rows_per_floor * data.cols_per_floor

    bus_type = BusType(
        **data.model_dump(),
        total_seats=total_seats,
    )
    db.add(bus_type)
    db.flush()

    seats = _generate_seats(bus_type)
    db.add_all(seats)

    db.commit()
    db.refresh(bus_type)
    return bus_type


def update_bus_type(db: Session, bus_type: BusType, data: BusTypeUpdate) -> BusType:
    update_data = data.model_dump(exclude_unset=True)

    layout_fields = {"floors", "rows_per_floor", "cols_per_floor", "seat_type"}
    changing_layout = any(f in update_data for f in layout_fields)

    if changing_layout and _has_trips_using_bus_type(db, bus_type.id):
        raise HTTPException(
            status_code=400,
            detail="Loại xe đã có chuyến sử dụng, không được sửa sơ đồ ghế (floors / rows / cols / seat_type)",
        )

    for field, value in update_data.items():
        setattr(bus_type, field, value)

    if changing_layout:
        old_seats = db.scalars(
            select(Seat).where(Seat.bus_type_id == bus_type.id)
        ).all()
        for s in old_seats:
            db.delete(s)

        bus_type.total_seats = (
            bus_type.floors * bus_type.rows_per_floor * bus_type.cols_per_floor
        )
        db.flush()
        new_seats = _generate_seats(bus_type)
        db.add_all(new_seats)

    db.commit()
    db.refresh(bus_type)
    return bus_type


def delete_bus_type(db: Session, bus_type: BusType) -> dict:
    has_buses = db.scalar(
        select(Bus.id).where(Bus.bus_type_id == bus_type.id).limit(1)
    )
    if has_buses:
        bus_type.is_active = False
        db.commit()
        return {
            "action": "deactivated",
            "message": "Loại xe đã có xe sử dụng, đã chuyển sang ngừng hoạt động",
        }

    db.delete(bus_type)
    db.commit()
    return {"action": "deleted", "message": "Đã xóa loại xe và sơ đồ ghế"}