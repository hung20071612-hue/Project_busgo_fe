
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.booking import Booking
from app.models.booking_detail import BookingDetail
from app.models.trip import Trip
from app.models.payment import Payment


router = APIRouter(prefix="/bookings", tags=["Cancel Booking"])


# 1. Hủy vé và tính tiền hoàn
@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    user_id: str,
    db: Session = Depends(get_db)
):
    # Kiểm tra vé có thuộc khách hàng không
    booking = db.query(Booking).filter(
        Booking.booking_id == booking_id,
        Booking.user_id == user_id
    ).first()

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy vé hoặc vé không thuộc khách hàng"
        )

    # Kiểm tra trạng thái vé
    if booking.status != "paid":
        raise HTTPException(
            status_code=400,
            detail="Vé không thể hủy"
        )

    # Lấy thông tin chuyến xe
    trip = db.query(Trip).filter(
        Trip.trip_id == booking.trip_id
    ).first()

    if trip is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy chuyến xe"
        )

    # Kiểm tra chuyến đã khởi hành chưa
    now = datetime.now()

    if trip.departure_time <= now:
        raise HTTPException(
            status_code=400,
            detail="Chuyến xe đã khởi hành, không thể hủy"
        )

    # Tính tiền hoàn theo chính sách 24 giờ
    remaining_time = trip.departure_time - now

    if remaining_time >= timedelta(hours=24):
        refund_amount = booking.total_price

        payments = db.query(Payment).filter(
            Payment.booking_id == booking_id,
            Payment.status == "successful"
        ).all()

        for payment in payments:
            payment.status = "refunded"

        refund_message = "Hoàn 100% tiền vé"
    else:
        refund_amount = Decimal("0")
        refund_message = "Không được hoàn tiền"

    # Cập nhật trạng thái vé
    booking.status = "cancelled"

    db.commit()

    return {
        "message": "Hủy vé thành công",
        "booking_id": booking_id,
        "refund_amount": refund_amount,
        "refund_policy": refund_message,
        "booking_status": booking.status
    }


# 2. Lấy danh sách ghế còn được đặt trong chuyến
@router.get("/trips/{trip_id}/booked-seats")
def get_booked_seats(
    trip_id: int,
    db: Session = Depends(get_db)
):
    booked_seats = db.query(BookingDetail).join(
        Booking,
        Booking.booking_id == BookingDetail.booking_id
    ).filter(
        BookingDetail.trip_id == trip_id,
        Booking.status.in_(["holding", "paid"])
    ).all()

    return {
        "trip_id": trip_id,
        "booked_seats": booked_seats
    }
