from sqlalchemy import select, or_
from sqlalchemy.orm import Session

from app.models.station import Station
from app.models.route import Route
from app.models.trip import Trip
from app.schemas.station import StationCreate, StationUpdate


def get_stations(db: Session, keyword: str | None = None, active_only: bool = False):
    query = select(Station).order_by(Station.id.desc())
    if keyword:
        query = query.where(Station.name.contains(keyword))
    if active_only:
        query = query.where(Station.is_active == True)
    return list(db.scalars(query))


def get_station(db: Session, station_id: int) -> Station | None:
    return db.get(Station, station_id)


def create_station(db: Session, data: StationCreate) -> Station:
    station = Station(**data.model_dump())
    db.add(station)
    db.commit()
    db.refresh(station)
    return station


def update_station(db: Session, station: Station, data: StationUpdate) -> Station:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(station, field, value)
    db.commit()
    db.refresh(station)
    return station


def delete_station(db: Session, station: Station) -> dict:
    """Bến đã có chuyến → ngừng hoạt động; chưa có → xóa cứng"""
    has_trips = db.scalar(
        select(Trip.id)
        .join(Route, Trip.route_id == Route.id)
        .where(
            or_(
                Route.departure_id == station.id,
                Route.arrival_id == station.id,
            )
        )
        .limit(1)
    )

    if has_trips:
        station.is_active = False
        db.commit()
        return {
            "action": "deactivated",
            "message": "Bến đã có chuyến, đã chuyển sang ngừng hoạt động"
        }

    db.delete(station)
    db.commit()
    return {"action": "deleted", "message": "Đã xóa bến xe"}