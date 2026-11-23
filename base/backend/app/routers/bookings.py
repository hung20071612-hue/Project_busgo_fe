"""API tạo đơn đặt vé. Đường dẫn đầy đủ: POST /api/bookings
Gọi sau khi đã giữ ghế (POST /api/trips/{trip_id}/holds), gửi kèm booking_id nhận được.
Lỗi: 404 không thấy, 400 thiếu thông tin, 409 ghế hết hạn/đã bị người khác đặt.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.crud import booking as booking_crud
from app.db.session import get_db
from app.schemas.booking import BookingCreateIn, BookingOut

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(data: BookingCreateIn, db: Session = Depends(get_db)):
    try:
        return booking_crud.create_booking(
            db,
            user_id=data.user_id,
            booking_id=data.booking_id,
            pickup=data.pickup,
            dropoff=data.dropoff,
            passengers=[p.model_dump() for p in data.passengers],
        )
    except booking_crud.BookingError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message)


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: int,
    user_id: str = Query(min_length=1, max_length=5),  # TẠM, thay bằng user từ JWT
    db: Session = Depends(get_db),
):
    try:
        return booking_crud.get_booking(db, booking_id, user_id)
    except booking_crud.BookingError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message)