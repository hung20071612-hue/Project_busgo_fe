"""Thanh toán giả lập: xác nhận thanh toán và đổi trạng thái vé.

Trong 1 transaction: khóa đơn -> kiểm tra đơn còn hiệu lực, ghế còn giữ, đã có đủ
thông tin hành khách -> ghi payments -> đơn chuyển PAID -> bỏ hold_until
(ghế thành "đã đặt" hẳn).
"""
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.crud.booking import GONE_MESSAGE, BookingError


def pay_booking(db: Session, user_id: str, booking_id: int, method: str) -> dict:
    try:
        bk = db.execute(
            text(
                "SELECT booking_id, booking_code, user_id, trip_id, total_price, status "
                "FROM bookings WHERE booking_id = :b FOR UPDATE"
            ),
            {"b": booking_id},
        ).mappings().first()
        if bk is None:  # đơn tạm đã bị dọn vì hết hạn giữ ghế
            db.rollback()
            raise BookingError(409, GONE_MESSAGE)
        if bk["user_id"] != user_id:
            db.rollback()
            raise BookingError(404, "Không tìm thấy đơn đặt vé")
        if bk["status"] == "PAID":
            db.rollback()
            raise BookingError(409, "Đơn này đã được thanh toán")
        if bk["status"] == "CANCELLED":
            db.rollback()
            raise BookingError(409, "Đơn này đã bị hủy")

        details = db.execute(
            text(
                "SELECT seat_id, passenger_name, passenger_phone, pickup, dropoff, "
                "(hold_until IS NULL OR hold_until > NOW()) AS valid "
                "FROM booking_details WHERE booking_id = :b FOR UPDATE"
            ),
            {"b": booking_id},
        ).mappings().all()
        if not details:
            db.rollback()
            raise BookingError(409, GONE_MESSAGE)
        if any(not d["valid"] for d in details):
            db.rollback()
            raise BookingError(409, "Đã hết thời gian giữ ghế, hãy chọn lại ghế")
        # Phải chốt đơn (nhập hành khách, điểm đón/trả) trước khi thanh toán
        if any(
            not (d["passenger_name"] and d["passenger_phone"] and d["pickup"] and d["dropoff"])
            for d in details
        ):
            db.rollback()
            raise BookingError(
                400, "Chưa nhập đủ thông tin hành khách và điểm đón/trả, hãy tạo đơn trước khi thanh toán"
            )

        departed = db.execute(
            text("SELECT (departure_time <= NOW()) FROM trips WHERE id = :t"),
            {"t": bk["trip_id"]},
        ).scalar()
        if departed:
            db.rollback()
            raise BookingError(400, "Chuyến đã khởi hành, không thể thanh toán")

        # Số tiền lấy từ đơn ở server, không nhận từ FE
        payment_id = db.execute(
            text(
                "INSERT INTO payments (booking_id, method, amount, status) "
                "VALUES (:b, :m, :a, 'SUCCESS')"
            ),
            {"b": booking_id, "m": method, "a": bk["total_price"]},
        ).lastrowid
        db.execute(
            text("UPDATE bookings SET status = 'PAID' WHERE booking_id = :b"), {"b": booking_id}
        )
        db.execute(
            text("UPDATE booking_details SET hold_until = NULL WHERE booking_id = :b"),
            {"b": booking_id},
        )
        db.commit()
    except BookingError:
        raise
    except (IntegrityError, OperationalError):
        db.rollback()
        raise BookingError(409, "Không thể thanh toán lúc này, hãy thử lại")

    pay = db.execute(
        text("SELECT payment_id, method, amount, status, paid_at FROM payments WHERE payment_id = :p"),
        {"p": payment_id},
    ).mappings().first()
    return {
        "payment_id": pay["payment_id"],
        "booking_id": booking_id,
        "booking_code": bk["booking_code"],
        "booking_status": "PAID",
        "method": pay["method"],
        "amount": pay["amount"],
        "status": pay["status"],
        "paid_at": pay["paid_at"],
    }