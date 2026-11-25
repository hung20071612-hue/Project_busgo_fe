from datetime import datetime
from decimal import Decimal

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.models import Booking, Bus, Driver, Route, Trip, TripStatus
from app.models.booking import BookingStatus, Payment, PaymentStatus
from app.models.bus import BusStatusEnum
from app.models.driver import DriverStatusEnum
from app.schemas.trip import TripCreate, TripUpdate


def list_trips(db: Session) -> list[Trip]:
    return list(db.scalars(select(Trip).order_by(Trip.departure_at.desc(), Trip.id.desc())))


def get_trip(db: Session, trip_id: int) -> Trip | None:
    return db.get(Trip, trip_id)


def validate_references(
    db: Session,
    route_id: int,
    bus_id: int,
    driver_id: int,
    departure_at: datetime | None = None,
    arrival_at: datetime | None = None,
    exclude_trip_id: int | None = None,
) -> str | None:
    route = db.get(Route, route_id)
    if route is None:
        return f"Không tìm thấy tuyến đường id={route_id}"
    if not route.is_active:
        return f"Tuyến đường id={route_id} hiện không hoạt động"

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

    if departure_at is not None and arrival_at is not None:
        overlap_conditions = [
            Trip.status != TripStatus.CANCELLED,
            Trip.departure_at < arrival_at,
            Trip.arrival_at > departure_at,
        ]
        if exclude_trip_id is not None:
            overlap_conditions.append(Trip.id != exclude_trip_id)

        bus_conflict = db.scalar(
            select(Trip.id).where(and_(Trip.bus_id == bus_id, *overlap_conditions)).limit(1)
        )
        if bus_conflict is not None:
            return f"Xe id={bus_id} đã có lịch chạy trùng khung giờ này"

        driver_conflict = db.scalar(
            select(Trip.id).where(and_(Trip.driver_id == driver_id, *overlap_conditions)).limit(1)
        )
        if driver_conflict is not None:
            return f"Tài xế id={driver_id} đã có lịch chạy trùng khung giờ này"

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

    if data.status == TripStatus.CANCELLED and trip.status != TripStatus.CANCELLED:
        trip.status = TripStatus.CANCELLED
        now = db.scalar(select(func.now()))
        active_bookings = list(
            db.scalars(
                select(Booking).where(
                    Booking.trip_id == trip.id,
                    Booking.status.in_([BookingStatus.PENDING_PAYMENT, BookingStatus.PAID]),
                )
            )
        )
        for booking in active_bookings:
            if booking.status == BookingStatus.PAID:
                booking.refund_amount = booking.total_price
                payments = list(
                    db.scalars(
                        select(Payment).where(
                            Payment.booking_id == booking.booking_id,
                            Payment.status == PaymentStatus.SUCCESS,
                        )
                    )
                )
                for payment in payments:
                    payment.status = PaymentStatus.REFUNDED
            else:
                booking.refund_amount = Decimal("0")

            booking.status = BookingStatus.CANCELLED
            booking.cancelled_at = now

    db.commit()
    db.refresh(trip)
    return trip


def has_bookings(db: Session, trip_id: int) -> bool:
    return db.scalar(select(Booking.booking_id).where(Booking.trip_id == trip_id).limit(1)) is not None


def delete_trip(db: Session, trip: Trip) -> None:
    db.delete(trip)
    db.commit()