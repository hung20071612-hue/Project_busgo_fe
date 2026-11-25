from datetime import timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.booking import (
    Booking,
    BookingDetail,
    BookingStatus,
    Payment,
    PaymentStatus,
)
from app.models.trip import Trip

router = APIRouter(prefix="/bookings", tags=["Cancel Booking"])


@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    user_id: int,
    db: Session = Depends(get_db),
):
    booking = (
        db.query(Booking)
        .filter(
            Booking.booking_id == booking_id,
            Booking.user_id == user_id,
        )
        .with_for_update()
        .first()
    )

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy vé hoặc vé không thuộc khách hàng",
        )

    if booking.status != BookingStatus.PAID:
        raise HTTPException(
            status_code=400,
            detail="Vé không thể hủy",
        )

    trip = db.query(Trip).filter(Trip.id == booking.trip_id).first()

    if trip is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy chuyến xe",
        )

    now = db.query(func.now()).scalar()

    if trip.departure_at <= now:
        raise HTTPException(
            status_code=400,
            detail="Chuyến xe đã khởi hành, không thể hủy",
        )

    remaining_time = trip.departure_at - now

    if remaining_time >= timedelta(hours=24):
        refund_amount = booking.total_price

        payments = (
            db.query(Payment)
            .filter(
                Payment.booking_id == booking_id,
                Payment.status == PaymentStatus.SUCCESS,
            )
            .all()
        )

        for payment in payments:
            payment.status = PaymentStatus.REFUNDED

        refund_message = "Hoàn 100% tiền vé"
    else:
        refund_amount = Decimal("0")
        refund_message = "Không được hoàn tiền"

    booking.status = BookingStatus.CANCELLED
    booking.refund_amount = refund_amount
    booking.cancelled_at = now

    db.commit()

    return {
        "message": "Hủy vé thành công",
        "booking_id": booking_id,
        "refund_amount": refund_amount,
        "refund_policy": refund_message,
        "booking_status": booking.status.value,
    }


@router.get("/trips/{trip_id}/booked-seats")
def get_booked_seats(
    trip_id: int,
    db: Session = Depends(get_db),
):
    seat_ids = (
        db.query(BookingDetail.seat_id)
        .join(
            Booking,
            Booking.booking_id == BookingDetail.booking_id,
        )
        .filter(
            BookingDetail.trip_id == trip_id,
            Booking.status.in_([BookingStatus.PENDING_PAYMENT, BookingStatus.PAID]),
        )
        .scalars()
        .all()
    )

    return {
        "trip_id": trip_id,
        "booked_seat_ids": list(seat_ids),
    }