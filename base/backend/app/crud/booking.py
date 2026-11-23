"""Tạo đơn đặt vé (chốt phiên giữ ghế) bằng transaction.

Luồng: giữ ghế (crud/seat_hold.py) đã tạo sẵn đơn PENDING_PAYMENT + booking_details.
Hàm create_booking chốt đơn trong 1 transaction:
  khóa đơn -> kiểm tra các ghế còn do CHÍNH khách này giữ và chưa hết hạn
  -> ghi thông tin hành khách, điểm đón/trả -> cập nhật tổng tiền -> commit.
Có ghế đã mất (hết hạn / người khác đặt) thì rollback toàn bộ và báo lỗi 409.
"""
import secrets
from datetime import datetime

from sqlalchemy import bindparam, text
from sqlalchemy.exc import IntegrityError, OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

GONE_MESSAGE = "Phiên giữ ghế đã hết hạn hoặc ghế đã bị người khác đặt, hãy chọn lại ghế"


class BookingError(Exception):
    """Lỗi nghiệp vụ; router đổi thành HTTPException."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


def generate_booking_code(db: Session) -> str:
    """Sinh mã vé duy nhất, dạng BG260715A1B2C3 (BG + yymmdd + 6 ký tự hex)."""
    for _ in range(10):
        code = f"BG{datetime.now():%y%m%d}{secrets.token_hex(3).upper()}"
        exists = db.execute(
            text("SELECT 1 FROM bookings WHERE booking_code = :c"), {"c": code}
        ).first()
        if exists is None:
            return code
    raise RuntimeError("Không sinh được mã vé duy nhất")


def _seat_codes(db: Session, seat_ids: list[int]) -> str:
    rows = db.execute(
        text("SELECT seat_code FROM seats WHERE id IN :ids ORDER BY id").bindparams(
            bindparam("ids", expanding=True)
        ),
        {"ids": list(seat_ids)},
    ).scalars().all()
    return ", ".join(rows)


def _route_names(db: Session, trip_id: int) -> tuple[str | None, str | None]:
    """Tên bến đi/đến của chuyến. Lỗi (thiếu bảng routes/stations) thì trả None, không làm hỏng API."""
    try:
        row = db.execute(
            text(
                """
                SELECT s1.name AS from_name, s2.name AS to_name
                FROM trips t
                JOIN routes r    ON r.id = t.route_id
                JOIN stations s1 ON s1.id = r.departure_id
                JOIN stations s2 ON s2.id = r.arrival_id
                WHERE t.id = :t
                """
            ),
            {"t": trip_id},
        ).mappings().first()
    except SQLAlchemyError:
        db.rollback()
        return None, None
    return (row["from_name"], row["to_name"]) if row else (None, None)


def booking_info(db: Session, booking_id: int) -> dict:
    head = db.execute(
        text(
            "SELECT booking_id, booking_code, status, trip_id, total_price "
            "FROM bookings WHERE booking_id = :b"
        ),
        {"b": booking_id},
    ).mappings().first()
    rows = db.execute(
        text(
            """
            SELECT bd.seat_id, s.seat_code, bd.passenger_name, bd.passenger_phone,
                   bd.pickup, bd.dropoff, bd.hold_until,
                   TIMESTAMPDIFF(SECOND, NOW(), bd.hold_until) AS left_s
            FROM booking_details bd JOIN seats s ON s.id = bd.seat_id
            WHERE bd.booking_id = :b ORDER BY bd.seat_id
            """
        ),
        {"b": booking_id},
    ).mappings().all()
    hold_until = min((r["hold_until"] for r in rows if r["hold_until"]), default=None)
    left = min((r["left_s"] for r in rows if r["left_s"] is not None), default=None)
    departure_time = db.execute(
        text("SELECT departure_time FROM trips WHERE id = :t"), {"t": head["trip_id"]}
    ).scalar()
    from_station, to_station = _route_names(db, head["trip_id"])
    pay = db.execute(
        text(
            "SELECT method, paid_at FROM payments WHERE booking_id = :b "
            "ORDER BY payment_id DESC LIMIT 1"
        ),
        {"b": booking_id},
    ).mappings().first()
    return {
        "booking_id": head["booking_id"],
        "booking_code": head["booking_code"],
        "status": head["status"],
        "trip_id": head["trip_id"],
        "departure_time": departure_time,
        "from_station": from_station,
        "to_station": to_station,
        "payment_method": pay["method"] if pay else None,
        "paid_at": pay["paid_at"] if pay else None,
        "total_price": head["total_price"],
        "pickup": rows[0]["pickup"] if rows else None,
        "dropoff": rows[0]["dropoff"] if rows else None,
        "hold_until": hold_until,
        "hold_seconds_left": max(int(left), 0) if left is not None else None,
        "passengers": [
            {
                "seat_id": r["seat_id"],
                "seat_code": r["seat_code"],
                "passenger_name": r["passenger_name"],
                "passenger_phone": r["passenger_phone"],
            }
            for r in rows
        ],
    }


def create_booking(
    db: Session,
    user_id: str,
    booking_id: int,
    pickup: str,
    dropoff: str,
    passengers: list[dict],
) -> dict:
    try:
        # 1. Khóa đơn để không ai sửa/nhả ghế cùng lúc
        bk = db.execute(
            text(
                "SELECT booking_id, user_id, trip_id, status FROM bookings "
                "WHERE booking_id = :b FOR UPDATE"
            ),
            {"b": booking_id},
        ).mappings().first()
        if bk is None:  # đơn tạm đã bị dọn vì hết hạn
            db.rollback()
            raise BookingError(409, GONE_MESSAGE)
        if bk["user_id"] != user_id:
            db.rollback()
            raise BookingError(404, "Không tìm thấy phiên giữ ghế")
        if bk["status"] != "PENDING_PAYMENT":
            db.rollback()
            raise BookingError(409, "Đơn này đã thanh toán hoặc đã hủy")

        # 2. Các ghế đang được giữ trong đơn này
        details = db.execute(
            text(
                "SELECT seat_id, (hold_until IS NULL OR hold_until > NOW()) AS valid "
                "FROM booking_details WHERE booking_id = :b FOR UPDATE"
            ),
            {"b": booking_id},
        ).mappings().all()
        if not details:
            db.rollback()
            raise BookingError(409, GONE_MESSAGE)
        held = {d["seat_id"]: d for d in details}
        sent = {p["seat_id"] for p in passengers}

        # 3. Ghế khách gửi lên mà không còn do khách này giữ -> rollback, báo lỗi
        lost = sent - held.keys()
        if lost:
            names = _seat_codes(db, sorted(lost))
            db.rollback()
            raise BookingError(
                409, f"Ghế {names} không còn được bạn giữ (hết hạn hoặc đã có người đặt), hãy chọn lại"
            )
        # Mỗi ghế đang giữ phải có thông tin hành khách
        missing = held.keys() - sent
        if missing:
            names = _seat_codes(db, sorted(missing))
            db.rollback()
            raise BookingError(400, f"Thiếu thông tin hành khách cho ghế {names}")
        # Hết hạn giữ nhưng chưa bị ai lấy: vẫn không cho chốt
        if any(not d["valid"] for d in details):
            db.rollback()
            raise BookingError(409, GONE_MESSAGE)

        # 4. Chuyến còn hợp lệ, tính lại tổng tiền ở server
        trip = db.execute(
            text("SELECT price, (departure_time <= NOW()) AS departed FROM trips WHERE id = :t"),
            {"t": bk["trip_id"]},
        ).mappings().first()
        if trip is None:
            db.rollback()
            raise BookingError(404, "Không tìm thấy chuyến của đơn này")
        if trip["departed"]:
            db.rollback()
            raise BookingError(400, "Chuyến đã khởi hành")

        # 5. Ghi thông tin hành khách, điểm đón/trả (hold_until giữ nguyên để còn hạn thanh toán)
        db.execute(
            text(
                "UPDATE booking_details SET passenger_name = :n, passenger_phone = :ph, "
                "pickup = :pu, dropoff = :dr WHERE booking_id = :b AND seat_id = :s"
            ),
            [
                {
                    "n": p["passenger_name"], "ph": p["passenger_phone"],
                    "pu": pickup, "dr": dropoff, "b": booking_id, "s": p["seat_id"],
                }
                for p in passengers
            ],
        )
        db.execute(
            text("UPDATE bookings SET total_price = :p WHERE booking_id = :b"),
            {"p": trip["price"] * len(held), "b": booking_id},
        )
        db.commit()
    except BookingError:
        raise
    except (IntegrityError, OperationalError):
        db.rollback()
        raise BookingError(409, "Không thể tạo đơn lúc này, hãy chọn lại ghế")

    return booking_info(db, booking_id)


def get_booking(db: Session, booking_id: int, user_id: str) -> dict:
    """Xem 1 đơn của chính mình (trang thanh toán, trang xác nhận)."""
    owner = db.execute(
        text("SELECT user_id FROM bookings WHERE booking_id = :b"), {"b": booking_id}
    ).scalar()
    if owner is None or owner != user_id:
        raise BookingError(404, "Không tìm thấy đơn đặt vé")
    return booking_info(db, booking_id)