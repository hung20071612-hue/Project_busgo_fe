"""Giữ ghế tạm 10 phút.

Cách hoạt động:
- Giữ ghế = tạo đơn bookings (PENDING_PAYMENT) + booking_details có hold_until = NOW() + 10 phút.
- Hết hạn: không cần job dọn. Ghế quá hạn được coi là trống; dòng cũ bị xóa
  ở lần có người khác giữ đúng ghế đó (hàm _clear_expired).
- 2 người giữ cùng ghế: UNIQUE(trip_id, seat_id) bảo đảm chỉ 1 INSERT thành công,
  người còn lại nhận lỗi 409.
- Mọi so sánh thời gian dùng NOW() của MySQL (cùng đồng hồ với seat_map).
"""
from datetime import datetime

from sqlalchemy import bindparam, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.crud.booking import generate_booking_code

MAX_SEATS_PER_HOLD = 5
HOLD_MINUTES = 10


class HoldError(Exception):
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


def _in(sql: str, name: str):
    return text(sql).bindparams(bindparam(name, expanding=True))


def _hold_info(db: Session, booking_id: int) -> dict:
    head = db.execute(
        text(
            "SELECT booking_code, trip_id, total_price FROM bookings WHERE booking_id = :b"
        ),
        {"b": booking_id},
    ).mappings().first()
    seats = db.execute(
        text(
            """
            SELECT seat_id, hold_until, TIMESTAMPDIFF(SECOND, NOW(), hold_until) AS left_s
            FROM booking_details WHERE booking_id = :b ORDER BY seat_id
            """
        ),
        {"b": booking_id},
    ).mappings().all()
    hold_until = min((s["hold_until"] for s in seats if s["hold_until"]), default=None)
    left = min((s["left_s"] for s in seats if s["left_s"] is not None), default=None)
    return {
        "booking_id": booking_id,
        "booking_code": head["booking_code"],
        "trip_id": head["trip_id"],
        "seat_ids": [s["seat_id"] for s in seats],
        "hold_until": hold_until,
        "hold_seconds_left": max(int(left), 0) if left is not None else None,
        "total_price": head["total_price"],
    }


def _clear_expired(db: Session, trip_id: int, seat_ids: list[int]) -> None:
    rows = db.execute(
        _in(
            """
            SELECT bd.detail_id, bd.booking_id
            FROM booking_details bd
            JOIN bookings b ON b.booking_id = bd.booking_id
            WHERE bd.trip_id = :t AND bd.seat_id IN :ids
              AND b.status = 'PENDING_PAYMENT'
              AND bd.hold_until IS NOT NULL AND bd.hold_until <= NOW()
            """,
            "ids",
        ),
        {"t": trip_id, "ids": seat_ids},
    ).mappings().all()
    if not rows:
        return
    db.execute(
        _in("DELETE FROM booking_details WHERE detail_id IN :d", "d"),
        {"d": [r["detail_id"] for r in rows]},
    )
    db.execute(
        _in(
            """
            DELETE FROM bookings
            WHERE booking_id IN :b AND status = 'PENDING_PAYMENT'
              AND NOT EXISTS (SELECT 1 FROM booking_details d WHERE d.booking_id = bookings.booking_id)
            """,
            "b",
        ),
        {"b": list({r["booking_id"] for r in rows})},
    )


def hold_seats(
    db: Session, trip_id: int, user_id: int, seat_ids: list[int], booking_id: int | None
) -> dict:
    seat_ids = sorted(set(seat_ids))

    trip = db.execute(
        text(
            """
            SELECT t.id AS trip_id, t.ticket_price, b.bus_type_id, (t.departure_at <= NOW()) AS departed
            FROM trips t JOIN buses b ON b.id = t.bus_id
            WHERE t.id = :t
            """
        ),
        {"t": trip_id},
    ).mappings().first()
    if trip is None:
        raise HoldError(404, f"Không tìm thấy chuyến id={trip_id}")
    if trip["departed"]:
        raise HoldError(400, "Chuyến đã khởi hành, không thể giữ ghế")

    if db.execute(text("SELECT 1 FROM `user` WHERE id = :u"), {"u": int(user_id)}).first() is None:
        raise HoldError(404, f"Không tìm thấy user id={user_id}")

    valid = db.execute(
        _in(
            "SELECT id AS seat_id, seat_code FROM seats "
            "WHERE bus_type_id = :bt AND is_active = 1 AND id IN :ids",
            "ids",
        ),
        {"bt": trip["bus_type_id"], "ids": seat_ids},
    ).mappings().all()
    code_of = {r["seat_id"]: r["seat_code"] for r in valid}
    bad = [i for i in seat_ids if i not in code_of]
    if bad:
        raise HoldError(400, f"Ghế không thuộc xe của chuyến này: {bad}")

    current: list = []
    hold_until: datetime | None = None
    if booking_id is not None:
        bk = db.execute(
            text(
                "SELECT booking_id, user_id, trip_id, status FROM bookings "
                "WHERE booking_id = :b FOR UPDATE"
            ),
            {"b": booking_id},
        ).mappings().first()
        if bk is None or int(bk["user_id"]) != int(user_id) or bk["trip_id"] != trip_id:
            db.rollback()
            raise HoldError(404, "Không tìm thấy phiên giữ ghế")
        if bk["status"] != "PENDING_PAYMENT":
            db.rollback()
            raise HoldError(409, "Đơn này đã thanh toán hoặc đã hủy, không thể thêm ghế")
        current = db.execute(
            text(
                "SELECT seat_id, hold_until, (hold_until <= NOW()) AS expired "
                "FROM booking_details WHERE booking_id = :b"
            ),
            {"b": booking_id},
        ).mappings().all()
        if any(c["expired"] for c in current):
            db.rollback()
            raise HoldError(409, "Phiên giữ ghế đã hết hạn, hãy chọn lại ghế")
        hold_until = min((c["hold_until"] for c in current if c["hold_until"]), default=None)

    have = {c["seat_id"] for c in current}
    new_ids = [i for i in seat_ids if i not in have]
    if len(have) + len(new_ids) > MAX_SEATS_PER_HOLD:
        db.rollback()
        raise HoldError(400, f"Chỉ được giữ tối đa {MAX_SEATS_PER_HOLD} ghế một lần")

    try:
        if new_ids:
            _clear_expired(db, trip_id, new_ids)

            taken = db.execute(
                _in(
                    "SELECT seat_id FROM booking_details WHERE trip_id = :t AND seat_id IN :ids",
                    "ids",
                ),
                {"t": trip_id, "ids": new_ids},
            ).scalars().all()
            if taken:
                db.rollback()
                names = ", ".join(code_of[i] for i in sorted(taken))
                raise HoldError(409, f"Ghế {names} đã có người giữ hoặc đặt, hãy chọn ghế khác")

            if hold_until is None:
                hold_until = db.execute(
                    text(f"SELECT NOW() + INTERVAL {HOLD_MINUTES} MINUTE")
                ).scalar()
            if booking_id is None:
                code = generate_booking_code(db)
                booking_id = db.execute(
                    text(
                        "INSERT INTO bookings (booking_code, user_id, trip_id, total_price, status) "
                        "VALUES (:c, :u, :t, 0, 'PENDING_PAYMENT')"
                    ),
                    {"c": code, "u": int(user_id), "t": trip_id},
                ).lastrowid

            db.execute(
                text(
                    "INSERT INTO booking_details (booking_id, trip_id, seat_id, hold_until) "
                    "VALUES (:b, :t, :s, :h)"
                ),
                [{"b": booking_id, "t": trip_id, "s": s, "h": hold_until} for s in new_ids],
            )
            db.execute(
                text("UPDATE bookings SET total_price = :p WHERE booking_id = :b"),
                {"p": trip["ticket_price"] * (len(have) + len(new_ids)), "b": booking_id},
            )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HoldError(409, "Ghế vừa có người khác giữ, hãy chọn lại")
    except OperationalError as error:
        db.rollback()
        if error.orig is not None and error.orig.args and error.orig.args[0] in (1205, 1213):
            raise HoldError(409, "Hệ thống đang bận, hãy thử lại")
        raise

    return _hold_info(db, booking_id)


def release_seats(
    db: Session, booking_id: int, user_id: int, seat_id: int | None
) -> dict | None:
    bk = db.execute(
        text(
            "SELECT booking_id, booking_code, user_id, trip_id, status FROM bookings "
            "WHERE booking_id = :b FOR UPDATE"
        ),
        {"b": booking_id},
    ).mappings().first()
    if bk is None or int(bk["user_id"]) != int(user_id):
        db.rollback()
        raise HoldError(404, "Không tìm thấy phiên giữ ghế")
    if bk["status"] != "PENDING_PAYMENT":
        db.rollback()
        raise HoldError(409, "Đơn đã thanh toán hoặc đã hủy, không thể nhả ghế")

    if seat_id is None:
        db.execute(text("DELETE FROM booking_details WHERE booking_id = :b"), {"b": booking_id})
        db.execute(text("DELETE FROM bookings WHERE booking_id = :b"), {"b": booking_id})
        db.commit()
        return None

    deleted = db.execute(
        text("DELETE FROM booking_details WHERE booking_id = :b AND seat_id = :s"),
        {"b": booking_id, "s": seat_id},
    ).rowcount
    if deleted == 0:
        db.rollback()
        raise HoldError(404, "Ghế này không nằm trong phiên giữ")

    remaining = db.execute(
        text("SELECT COUNT(*) FROM booking_details WHERE booking_id = :b"), {"b": booking_id}
    ).scalar()
    if remaining == 0:
        db.execute(text("DELETE FROM bookings WHERE booking_id = :b"), {"b": booking_id})
        db.commit()
        return {
            "booking_id": booking_id,
            "booking_code": bk["booking_code"],
            "trip_id": bk["trip_id"],
            "seat_ids": [],
            "hold_until": None,
            "hold_seconds_left": None,
            "total_price": 0,
        }

    price = db.execute(
        text("SELECT ticket_price FROM trips WHERE id = :t"), {"t": bk["trip_id"]}
    ).scalar()
    db.execute(
        text("UPDATE bookings SET total_price = :p WHERE booking_id = :b"),
        {"p": price * remaining, "b": booking_id},
    )
    db.commit()
    return _hold_info(db, booking_id)


def get_hold(db: Session, booking_id: int, user_id: int) -> dict:
    bk = db.execute(
        text("SELECT user_id, status FROM bookings WHERE booking_id = :b"), {"b": booking_id}
    ).mappings().first()
    if bk is None or int(bk["user_id"]) != int(user_id) or bk["status"] != "PENDING_PAYMENT":
        raise HoldError(404, "Không tìm thấy phiên giữ ghế")
    valid = db.execute(
        text(
            "SELECT COUNT(*) FROM booking_details "
            "WHERE booking_id = :b AND (hold_until IS NULL OR hold_until > NOW())"
        ),
        {"b": booking_id},
    ).scalar()
    if not valid:
        raise HoldError(404, "Phiên giữ ghế đã hết hạn")
    return _hold_info(db, booking_id)