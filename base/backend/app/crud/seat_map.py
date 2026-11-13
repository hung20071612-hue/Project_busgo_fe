"""Truy vấn sơ đồ ghế của 1 chuyến."""
from sqlalchemy import text
from sqlalchemy.orm import Session


def get_seat_map(db: Session, trip_id: int) -> dict | None:
    """Trả dict sơ đồ ghế, hoặc None nếu không có chuyến này."""
    # 1. Chuyến -> xe -> loại xe (loại xe quyết định bố cục ghế)
    layout = db.execute(
        text(
            """
            SELECT t.id AS trip_id, bt.id AS bus_type_id, bt.name, bt.floors,
                   bt.rows_per_floor, bt.cols_per_floor
            FROM trips t
            JOIN buses b       ON b.id = t.bus_id
            JOIN bus_types bt  ON bt.id = b.bus_type_id
            WHERE t.id = :trip_id
            """
        ),
        {"trip_id": trip_id},
    ).mappings().first()
    if layout is None:
        return None

    # 2. Toàn bộ ghế của loại xe, theo thứ tự tầng -> hàng -> cột
    seats = db.execute(
        text(
            """
            SELECT id AS seat_id, seat_code, floor, row_num, col_num, seat_type
            FROM seats
            WHERE bus_type_id = :bus_type_id AND is_active = 1
            ORDER BY floor, row_num, col_num
            """
        ),
        {"bus_type_id": layout["bus_type_id"]},
    ).mappings().all()

    # 3. Ghế đã có người đặt/giữ trong chuyến này (bỏ đơn đã hủy).
    #    Giờ so sánh dùng NOW() của MySQL để cùng đồng hồ với lúc ghi hold_until.
    taken_rows = db.execute(
        text(
            """
            SELECT bd.seat_id,
                   b.status AS booking_status,
                   (bd.hold_until IS NULL OR bd.hold_until > NOW()) AS hold_valid,
                   TIMESTAMPDIFF(SECOND, NOW(), bd.hold_until) AS seconds_left
            FROM booking_details bd
            JOIN bookings b ON b.booking_id = bd.booking_id
            WHERE bd.trip_id = :trip_id AND b.status <> 'CANCELLED'
            """
        ),
        {"trip_id": trip_id},
    ).mappings().all()

    taken = {r["seat_id"]: r for r in taken_rows}

    result_seats = []
    available = 0
    for s in seats:
        status = "AVAILABLE"
        seconds_left = None
        row = taken.get(s["seat_id"])
        if row is not None:
            if row["booking_status"] == "PAID":
                status = "BOOKED"
            elif row["hold_valid"]:  # PENDING_PAYMENT và còn hạn giữ
                status = "HELD"
                if row["seconds_left"] is not None:
                    seconds_left = max(int(row["seconds_left"]), 0)
            # PENDING_PAYMENT nhưng hết hạn -> coi như trống (giữ nguyên AVAILABLE)
        if status == "AVAILABLE":
            available += 1
        result_seats.append(
            {
                "seat_id": s["seat_id"],
                "seat_code": s["seat_code"],
                "floor": s["floor"],
                "row_num": s["row_num"],
                "col_num": s["col_num"],
                "seat_type": s["seat_type"],
                "status": status,
                "hold_seconds_left": seconds_left,
            }
        )

    return {
        "trip_id": layout["trip_id"],
        "bus_type_name": layout["name"],
        "floors": layout["floors"],
        "rows_per_floor": layout["rows_per_floor"],
        "cols_per_floor": layout["cols_per_floor"],
        "total_seats": len(result_seats),
        "available_count": available,
        "seats": result_seats,
    }