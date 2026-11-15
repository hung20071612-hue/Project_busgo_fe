from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.booking import Booking
from app.models.booking import BookingDetail


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
    
    
