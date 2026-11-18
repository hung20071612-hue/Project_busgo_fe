from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, aliased

from app.db.session import get_db
from app.models.booking import Booking, BookingDetail
from app.models.trip import Trip
from app.models.route import Route
from app.models.station import Station
from app.models.bus import Bus
from app.models.seat import Seat

router = APIRouter(prefix="/bookings", tags=["Bookings"])


# 1. Tra cứu vé bằng mã đặt vé và số điện thoại
@router.get("/lookup")
def lookup_booking(
    booking_id: int,
    phone: str,
    db: Session = Depends(get_db)
):
    booking = db.query(Booking).filter(
        Booking.booking_id == booking_id
    ).first()

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy vé"
        )

    details = db.query(BookingDetail).filter(
        BookingDetail.booking_id == booking_id,
        BookingDetail.passenger_phone == phone
    ).all()

    if not details:
        raise HTTPException(
            status_code=404,
            detail="Thông tin vé không hợp lệ"
        )

    return {
        "booking": booking,
        "details": details
    }


# 2. Danh sách vé theo khách hàng và trạng thái
@router.get("")
def list_bookings(
    user_id: str,
    status: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(Booking).filter(
        Booking.user_id == user_id
    )

    if status:
        query = query.filter(
            Booking.status == status
        )

    return query.all()


# 3. Chi tiết vé theo mã đặt vé
@router.get("/{booking_id}")
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db)
):
    booking = db.query(Booking).filter(
        Booking.booking_id == booking_id
    ).first()

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy vé"
        )

    details = db.query(BookingDetail).filter(
        BookingDetail.booking_id == booking_id
    ).all()

    return {
        "booking": booking,
        "details": details
    }
    
    
# 4. Danh sách chuyến xe trong ngày dành cho nhân viên
@router.get("/staff/today-trips")
def get_today_trips(db: Session = Depends(get_db)):
    today = date.today()

    start_time = datetime.combine(today, time.min)
    end_time = start_time + timedelta(days=1)

    departure_station = aliased(Station)
    arrival_station = aliased(Station)

    trips = (
        db.query(
            Trip.id.label("trip_id"),
            Trip.departure_at,
            Trip.arrival_at,
            Trip.status,
            Route.code.label("route_code"),
            departure_station.name.label("departure_station"),
            arrival_station.name.label("arrival_station"),
            Bus.plate_number
        )
        .join(Route, Trip.route_id == Route.id)
        .join(
            departure_station,
            Route.departure_id == departure_station.id
        )
        .join(
            arrival_station,
            Route.arrival_id == arrival_station.id
        )
        .join(Bus, Trip.bus_id == Bus.id)
        .filter(
            Trip.departure_at >= start_time,
            Trip.departure_at < end_time
        )
        .order_by(Trip.departure_at)
        .all()
    )

    return [
        {
            "trip_id": trip.trip_id,
            "departure_at": trip.departure_at,
            "arrival_at": trip.arrival_at,
            "status": trip.status,
            "route_code": trip.route_code,
            "departure_station": trip.departure_station,
            "arrival_station": trip.arrival_station,
            "plate_number": trip.plate_number
        }
        for trip in trips
    ]
    
# 5. Danh sách hành khách theo chuyến và ghế
@router.get("/staff/trips/{trip_id}/passengers")
def get_trip_passengers(
    trip_id: int,
    db: Session = Depends(get_db)
):
    trip = db.query(Trip).filter(
        Trip.id == trip_id
    ).first()

    if trip is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy chuyến xe"
        )

    passengers = (
        db.query(
            BookingDetail,
            Booking.booking_code,
            Seat.seat_code
        )
        .join(Booking, BookingDetail.booking_id == Booking.booking_id)
        .join(Seat, BookingDetail.seat_id == Seat.id)
        .filter(
            BookingDetail.trip_id == trip_id,
            Booking.status == "PAID"
        )
        .order_by(Seat.seat_code)
        .all()
    )

    return [
        {
            "detail_id": detail.detail_id,
            "booking_code": booking_code,
            "passenger_name": detail.passenger_name,
            "passenger_phone": detail.passenger_phone,
            "seat_code": seat_code,
            "is_boarded": detail.is_boarded,
            "boarded_at": detail.boarded_at
        }
        for detail, booking_code, seat_code in passengers
    ]
    
# 6. Xác nhận hành khách đã lên xe
@router.post("/staff/check-in")
def check_in_passenger(
    booking_code: str,
    detail_id: int,
    db: Session = Depends(get_db)
):
    booking = db.query(Booking).filter(
        Booking.booking_code == booking_code
    ).first()

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy mã vé"
        )

    if booking.status != "PAID":
        raise HTTPException(
            status_code=400,
            detail="Vé chưa được thanh toán"
        )

    detail = db.query(BookingDetail).filter(
        BookingDetail.detail_id == detail_id,
        BookingDetail.booking_id == booking.booking_id
    ).first()

    if detail is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy thông tin hành khách"
        )

    if detail.is_boarded:
        raise HTTPException(
            status_code=400,
            detail="Vé này đã được soát trước đó"
        )

    detail.is_boarded = True
    detail.boarded_at = datetime.now()

    db.commit()
    db.refresh(detail)

    return {
        "message": "Xác nhận hành khách lên xe thành công",
        "passenger_name": detail.passenger_name,
        "is_boarded": detail.is_boarded,
        "boarded_at": detail.boarded_at
    }