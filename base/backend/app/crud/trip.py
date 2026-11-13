from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Booking, Bus, Driver, Route, Trip, TripStatus
from app.models.bus import BusStatusEnum
from app.models.driver import DriverStatusEnum
from app.schemas.trip import TripCreate, TripUpdate


def list_trips(db: Session) -> list[Trip]:
    return list(db.scalars(select(Trip).order_by(Trip.departure_at.desc(), Trip.id.desc())))


def get_trip(db: Session, trip_id: int) -> Trip | None:
    return db.get(Trip, trip_id)


def validate_references(db: Session, route_id: int, bus_id: int, driver_id: int) -> str | None:
    if db.get(Route, route_id) is None:
        return f"Không tìm thấy tuyến đường id={route_id}"
    bus = db.get(Bus, bus_id)
    if bus is None:
        return f"Không tìm thấy xe id={bus_id}"
    if bus.status != BusStatusEnum.active:
        return f"Xe id={bus_id} hiện không hoạt động"
    driver = db.get(Driver, driver_id)
    if driver is None:
        return f"Không tìm thấy tài xế id={driver_id}"
    if driver.status != DriverStatusEnum.active:
        return f"Tài xế id={driver_id} hiện không hoạt động"
    return None


def create_trip(db: Session, data: TripCreate) -> Trip:
    trip = Trip(**data.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


def update_trip(db: Session, trip: Trip, data: TripUpdate) -> Trip:
    changes = data.model_dump(exclude_unset=True, exclude={"status"})
    for field, value in changes.items():
        setattr(trip, field, value)
    if data.status == TripStatus.CANCELLED:
        trip.status = TripStatus.CANCELLED
    db.commit()
    db.refresh(trip)
    return trip


def has_bookings(db: Session, trip_id: int) -> bool:
    return db.scalar(select(Booking.booking_id).where(Booking.trip_id == trip_id).limit(1)) is not None


def delete_trip(db: Session, trip: Trip) -> None:
    db.delete(trip)
    db.commit()