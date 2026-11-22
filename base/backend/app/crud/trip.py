from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.trip import Booking, BookingStatus, Bus, Driver, Route, Trip, TripStatus
from app.schemas.trip import TripCreate, TripUpdate


def list_trips(db: Session) -> list[Trip]:
    return list(db.scalars(select(Trip).order_by(Trip.departure_at.desc(), Trip.id.desc())))


def search_trips(
    db: Session,
    *,
    origin: str,
    destination: str,
    travel_date: date,
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    time_from: time | None = None,
    time_to: time | None = None,
    sort: str = "departure_asc",
) -> list[dict]:
    confirmed_bookings = (
        select(func.count(Booking.id))
        .where(
            Booking.trip_id == Trip.id,
            Booking.status == BookingStatus.CONFIRMED,
        )
        .correlate(Trip)
        .scalar_subquery()
    )
    available_seats = Bus.seat_count - confirmed_bookings
    start_of_day = datetime.combine(travel_date, time.min)
    start_of_next_day = start_of_day + timedelta(days=1)

    query = (
        select(
            Trip.id,
            Trip.route_id,
            Route.origin,
            Route.destination,
            Trip.bus_id,
            Bus.plate_number,
            Trip.driver_id,
            Trip.departure_at,
            Trip.arrival_at,
            Trip.ticket_price,
            available_seats.label("available_seats"),
        )
        .join(Route, Trip.route_id == Route.id)
        .join(Bus, Trip.bus_id == Bus.id)
        .where(
            Route.origin.ilike(f"%{origin.strip()}%"),
            Route.destination.ilike(f"%{destination.strip()}%"),
            Trip.departure_at >= start_of_day,
            Trip.departure_at < start_of_next_day,
            Trip.departure_at > func.now(),
            Trip.status == TripStatus.SCHEDULED,
            available_seats > 0,
        )
    )
    if min_price is not None:
        query = query.where(Trip.ticket_price >= min_price)
    if max_price is not None:
        query = query.where(Trip.ticket_price <= max_price)
    if time_from is not None and time_to is not None:
        if time_from <= time_to:
            query = query.where(
                Trip.departure_at >= datetime.combine(travel_date, time_from),
                Trip.departure_at <= datetime.combine(travel_date, time_to),
            )
        else:
            # A range such as 22:00–02:00 crosses midnight.
            query = query.where(
                or_(
                    Trip.departure_at >= datetime.combine(travel_date, time_from),
                    Trip.departure_at <= datetime.combine(travel_date, time_to),
                )
            )

    ordering = {
        "departure_asc": (Trip.departure_at.asc(), Trip.id.asc()),
        "departure_desc": (Trip.departure_at.desc(), Trip.id.desc()),
        "price_asc": (Trip.ticket_price.asc(), Trip.departure_at.asc(), Trip.id.asc()),
        "price_desc": (Trip.ticket_price.desc(), Trip.departure_at.asc(), Trip.id.asc()),
    }
    return [dict(row) for row in db.execute(query.order_by(*ordering[sort])).mappings()]


def list_trip_options(db: Session) -> dict:
    return {
        "routes": [
            {"id": route.id, "origin": route.origin, "destination": route.destination}
            for route in db.scalars(select(Route).order_by(Route.origin, Route.destination))
        ],
        "buses": [
            {"id": bus.id, "plate_number": bus.plate_number, "seat_count": bus.seat_count}
            for bus in db.scalars(select(Bus).where(Bus.is_active.is_(True)).order_by(Bus.plate_number))
        ],
        "drivers": [
            {"id": driver.id, "full_name": driver.full_name}
            for driver in db.scalars(select(Driver).where(Driver.is_active.is_(True)).order_by(Driver.full_name))
        ],
    }


def get_trip_details(db: Session, trip_id: int) -> dict | None:
    confirmed_bookings = (
        select(func.count(Booking.id))
        .where(Booking.trip_id == Trip.id, Booking.status == BookingStatus.CONFIRMED)
        .correlate(Trip)
        .scalar_subquery()
    )
    row = db.execute(
        select(
            Trip.id,
            Trip.route_id,
            Route.origin,
            Route.destination,
            Trip.bus_id,
            Bus.plate_number,
            Bus.seat_count,
            Trip.driver_id,
            Driver.full_name.label("driver_name"),
            Trip.departure_at,
            Trip.arrival_at,
            Trip.ticket_price,
            Trip.status,
            (Bus.seat_count - confirmed_bookings).label("available_seats"),
        )
        .join(Route, Trip.route_id == Route.id)
        .join(Bus, Trip.bus_id == Bus.id)
        .join(Driver, Trip.driver_id == Driver.id)
        .where(Trip.id == trip_id)
    ).mappings().first()
    return dict(row) if row else None


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
