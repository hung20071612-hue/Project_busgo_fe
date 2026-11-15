from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth_dep import get_current_user
from app.models.booking import Booking, BookingDetail
from app.models.user import UserModel

router = APIRouter(prefix="/bookings", tags=["Bookings"])


def _get_role_name(user: UserModel) -> str:
    raw_role = user.role.value if hasattr(user.role, "value") else user.role
    return str(raw_role).upper()


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
    user_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    role = _get_role_name(current_user)
    query = db.query(Booking)

    if role in ("ADMIN", "STAFF"):
        if user_id is not None:
            query = query.filter(Booking.user_id == user_id)
    else:
        if user_id is not None and user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Bạn không có quyền xem vé của người dùng khác"
            )
        query = query.filter(Booking.user_id == current_user.id)

    if status:
        query = query.filter(Booking.status == status)

    return query.all()


# 3. Chi tiết vé theo mã đặt vé
@router.get("/{booking_id}")
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    booking = db.query(Booking).filter(
        Booking.booking_id == booking_id
    ).first()

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy vé"
        )

    role = _get_role_name(current_user)
    if role not in ("ADMIN", "STAFF") and booking.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Bạn không có quyền xem thông tin vé này"
        )

    details = db.query(BookingDetail).filter(
        BookingDetail.booking_id == booking_id
    ).all()

    return {
        "booking": booking,
        "details": details
    }