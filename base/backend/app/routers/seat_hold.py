"""API giữ ghế tạm 10 phút.

    GET    /api/holds/{booking_id}                    xem lại phiên giữ ghế (khi tải lại trang)
    POST   /api/trips/{trip_id}/holds                 giữ 1-5 ghế (hoặc thêm ghế vào phiên cũ)
    DELETE /api/holds/{booking_id}/seats/{seat_id}    bỏ chọn 1 ghế (nhả ghế)
    DELETE /api/holds/{booking_id}                    nhả toàn bộ phiên giữ

Lỗi: 400 dữ liệu sai / quá 5 ghế, 404 không thấy, 409 ghế đã có người giữ/đặt.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.crud import seat_hold as hold_crud
from app.db.session import get_db
from app.schemas.seat_hold import SeatHoldIn, SeatHoldOut

router = APIRouter(tags=["Seat hold"])


def _raise(error: hold_crud.HoldError):
    raise HTTPException(status_code=error.status_code, detail=error.message)


@router.post("/trips/{trip_id}/holds", response_model=SeatHoldOut)
def hold_seats(trip_id: int, data: SeatHoldIn, db: Session = Depends(get_db)):
    try:
        return hold_crud.hold_seats(db, trip_id, data.user_id, data.seat_ids, data.booking_id)
    except hold_crud.HoldError as error:
        _raise(error)


@router.get("/holds/{booking_id}", response_model=SeatHoldOut)
def get_hold(
    booking_id: int,
    user_id: str = Query(min_length=1, max_length=5),  # TẠM, thay bằng user từ JWT
    db: Session = Depends(get_db),
):
    try:
        return hold_crud.get_hold(db, booking_id, user_id)
    except hold_crud.HoldError as error:
        _raise(error)


@router.delete("/holds/{booking_id}/seats/{seat_id}", response_model=SeatHoldOut)
def release_one_seat(
    booking_id: int,
    seat_id: int,
    user_id: str = Query(min_length=1, max_length=5),  # TẠM, thay bằng user từ JWT
    db: Session = Depends(get_db),
):
    try:
        return hold_crud.release_seats(db, booking_id, user_id, seat_id)
    except hold_crud.HoldError as error:
        _raise(error)


@router.delete("/holds/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def release_all(
    booking_id: int,
    user_id: str = Query(min_length=1, max_length=5),  # TẠM, thay bằng user từ JWT
    db: Session = Depends(get_db),
):
    try:
        hold_crud.release_seats(db, booking_id, user_id, None)
    except hold_crud.HoldError as error:
        _raise(error)
    return Response(status_code=status.HTTP_204_NO_CONTENT)