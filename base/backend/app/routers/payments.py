"""API thanh toán giả lập. Đường dẫn đầy đủ: POST /api/payments

Gọi sau khi đã tạo đơn (POST /api/bookings). method: CASH | TRANSFER | WALLET.
Thành công: đơn chuyển PENDING_PAYMENT -> PAID, ghế thành "đã đặt".
Lỗi: 404 không thấy đơn, 400 chưa nhập đủ thông tin, 409 đã thanh toán/hủy/hết hạn giữ ghế.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import booking as booking_crud
from app.crud import payment as payment_crud
from app.db.session import get_db
from app.schemas.payment import PaymentIn, PaymentOut

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post("", response_model=PaymentOut, status_code=status.HTTP_201_CREATED)
def pay(data: PaymentIn, db: Session = Depends(get_db)):
    try:
        return payment_crud.pay_booking(db, data.user_id, data.booking_id, data.method)
    except booking_crud.BookingError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message)