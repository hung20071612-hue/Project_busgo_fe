from datetime import datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.trip import Booking, Bus, Driver, Route, Trip, TripStatus
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
    if not bus.is_active:
        return f"Xe id={bus_id} hiện không hoạt động"
    driver = db.get(Driver, driver_id)
    if driver is None:
        return f"Không tìm thấy tài xế id={driver_id}"
    if not driver.is_active:
        return f"Tài xế id={driver_id} hiện không hoạt động"
    return None


def find_conflicts(
    db: Session,
    *,
    bus_id: int,
    driver_id: int,
    departure_at: datetime,
    arrival_at: datetime,
    exclude_trip_id: int | None = None,
) -> list[tuple[Trip, str]]:
    query = select(Trip).where(
        Trip.status != TripStatus.CANCELLED,
        Trip.departure_at < arrival_at,
        Trip.arrival_at > departure_at,
        or_(Trip.bus_id == bus_id, Trip.driver_id == driver_id),
    )
    if exclude_trip_id is not None:
        query = query.where(Trip.id != exclude_trip_id)
    conflicts: list[tuple[Trip, str]] = []
    for trip in db.scalars(query.order_by(Trip.departure_at)):
        if trip.bus_id == bus_id:
            conflicts.append((trip, "bus"))
        if trip.driver_id == driver_id:
            conflicts.append((trip, "driver"))
    return conflicts


def create_trip(db: Session, data: TripCreate) -> Trip:
    trip = Trip(**data.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


def create_repeated_trips(db: Session, data: TripCreate) -> tuple[list[Trip], list[dict]]:
    created: list[Trip] = []
    skipped: list[dict] = []
    duration = data.arrival_at - data.departure_at

    for day_offset in range(7):
        departure_at = data.departure_at + timedelta(days=day_offset)
        arrival_at = departure_at + duration
        conflicts = find_conflicts(
            db,
            bus_id=data.bus_id,
            driver_id=data.driver_id,
            departure_at=departure_at,
            arrival_at=arrival_at,
        )
        if conflicts:
            skipped.append({
                "date": departure_at.date(),
                "conflicts": [
                    {
                        "resource": resource,
                        "trip_id": trip.id,
                        "departure_at": trip.departure_at,
                        "arrival_at": trip.arrival_at,
                    }
                    for trip, resource in conflicts
                ],
            })
            continue

        trip = Trip(
            **data.model_dump(exclude={"departure_at", "arrival_at"}),
            departure_at=departure_at,
            arrival_at=arrival_at,
        )
        db.add(trip)
        db.flush()
        created.append(trip)

    db.commit()
    for trip in created:
        db.refresh(trip)
    return created, skipped


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
    return db.scalar(select(Booking.id).where(Booking.trip_id == trip_id).limit(1)) is not None


def delete_trip(db: Session, trip: Trip) -> None:
    db.delete(trip)
    db.commit()
