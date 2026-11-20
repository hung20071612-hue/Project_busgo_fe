
from datetime import date, datetime, time
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth_dep import RoleCheck
from app.models.booking import (
    Booking,
    BookingDetail,
    BookingStatus,
    Payment,
    PaymentStatus,
)
from app.models.trip import Trip, TripStatus
from app.models.route import Route
from app.models.bus import Bus
from app.models.bus_type import BusType


router = APIRouter(
    prefix="/statistics",
    tags=["Statistics"],
    dependencies=[Depends(RoleCheck(["admin"]))]
)


def get_date_conditions(column, start_date, end_date):
    conditions = []

    if start_date:
        conditions.append(
            column >= datetime.combine(start_date, time.min)
        )

    if end_date:
        conditions.append(
            column <= datetime.combine(end_date, time.max)
        )

    return conditions


# 1. Thống kê tổng số vé và doanh thu
@router.get("/summary")
def get_summary(
    start_date: date = None,
    end_date: date = None,
    db: Session = Depends(get_db)
):
    ticket_conditions = [
        Booking.status == BookingStatus.PAID
    ]
    ticket_conditions += get_date_conditions(
        Booking.created_at, start_date, end_date
    )

    total_tickets = db.scalar(
        select(func.count(BookingDetail.detail_id))
        .join(
            Booking,
            Booking.booking_id == BookingDetail.booking_id
        )
        .where(*ticket_conditions)
    ) or 0

    revenue_conditions = [
        Booking.status == BookingStatus.PAID,
        Payment.status == PaymentStatus.SUCCESS
    ]
    revenue_conditions += get_date_conditions(
        Payment.paid_at, start_date, end_date
    )

    total_revenue = db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0))
        .join(
            Booking,
            Booking.booking_id == Payment.booking_id
        )
        .where(*revenue_conditions)
    ) or 0

    return {
        "total_tickets": total_tickets,
        "total_revenue": total_revenue
    }


# 2. Thống kê tỷ lệ lấp đầy theo chuyến
@router.get("/trips/fill-rate")
def get_trip_fill_rate(
    start_date: date = None,
    end_date: date = None,
    db: Session = Depends(get_db)
):
    conditions = get_date_conditions(
        Trip.departure_at, start_date, end_date
    )

    result = db.execute(
        select(
            Trip.id,
            Route.code,
            Trip.departure_at,
            BusType.total_seats,
            func.count(BookingDetail.detail_id).label("sold_tickets")
        )
        .join(Route, Route.id == Trip.route_id)
        .join(Bus, Bus.id == Trip.bus_id)
        .join(BusType, BusType.id == Bus.bus_type_id)
        .outerjoin(
            BookingDetail,
            BookingDetail.trip_id == Trip.id
        )
        .outerjoin(
            Booking,
            Booking.booking_id == BookingDetail.booking_id
        )
        .where(
            *conditions,
            Trip.status != TripStatus.CANCELLED,
            (
                Booking.booking_id.is_(None)
                | (Booking.status == BookingStatus.PAID)
            )
        )
        .group_by(
            Trip.id,
            Route.code,
            Trip.departure_at,
            BusType.total_seats
        )
    ).all()

    data = []

    for row in result:
        capacity = row.total_seats or 0
        sold = row.sold_tickets or 0

        rate = round(sold / capacity * 100, 2) if capacity > 0 else 0

        data.append({
            "trip_id": row.id,
            "route": row.code,
            "departure_at": row.departure_at,
            "total_seats": capacity,
            "sold_tickets": sold,
            "occupancy_rate": rate
        })

    return data


# 3. Thống kê tỷ lệ lấp đầy theo tuyến
@router.get("/routes/fill-rate")
def get_route_fill_rate(
    start_date: date = None,
    end_date: date = None,
    db: Session = Depends(get_db)
):
    trips = get_trip_fill_rate(
        start_date=start_date,
        end_date=end_date,
        db=db
    )

    route_data = {}

    for trip in trips:
        route = trip["route"]

        if route not in route_data:
            route_data[route] = {
                "total_seats": 0,
                "sold_tickets": 0
            }

        route_data[route]["total_seats"] += trip["total_seats"]
        route_data[route]["sold_tickets"] += trip["sold_tickets"]

    result = []

    for route, values in route_data.items():
        capacity = values["total_seats"]
        sold = values["sold_tickets"]

        rate = round(sold / capacity * 100, 2) if capacity > 0 else 0

        result.append({
            "route": route,
            "total_seats": capacity,
            "sold_tickets": sold,
            "occupancy_rate": rate
        })

    return result


# 4. Thống kê doanh thu theo ngày
@router.get("/revenue/daily")
def get_daily_revenue(
    start_date: date = None,
    end_date: date = None,
    db: Session = Depends(get_db)
):
    conditions = [
        Booking.status == BookingStatus.PAID,
        Payment.status == PaymentStatus.SUCCESS
    ]
    conditions += get_date_conditions(
        Payment.paid_at, start_date, end_date
    )

    result = db.execute(
        select(
            func.date(Payment.paid_at).label("day"),
            func.sum(Payment.amount).label("revenue")
        )
        .join(
            Booking,
            Booking.booking_id == Payment.booking_id
        )
        .where(*conditions)
        .group_by(func.date(Payment.paid_at))
        .order_by(func.date(Payment.paid_at))
    ).all()

    return [
        {
            "date": str(row.day),
            "revenue": row.revenue
        }
        for row in result
    ]
