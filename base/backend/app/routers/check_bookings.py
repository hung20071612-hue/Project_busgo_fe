import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db

router = APIRouter(prefix="/bookings", tags=["Check & Lookup Bookings"])


def _normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("84") and len(digits) >= 11:
        digits = "0" + digits[2:]
    return digits


@router.get("/lookup")
def lookup_booking(
    code: Optional[str] = Query(None, description="Mã đặt vé hoặc ID"),
    booking_id: Optional[int] = Query(None, description="ID đặt vé"),
    phone: str = Query(..., description="Số điện thoại hành khách"),
    db: Session = Depends(get_db),
):
    raw_code = (code or (str(booking_id) if booking_id is not None else "")).strip().lstrip("#").upper()
    norm_phone = _normalize_phone(phone)

    if not raw_code or len(norm_phone) < 9:
        raise HTTPException(status_code=400, detail="Vui lòng nhập đầy đủ mã vé và số điện thoại hợp lệ")

    booking = db.execute(
        text(
            """
            SELECT b.booking_id, b.booking_code, b.user_id, b.trip_id,
                   b.total_price, b.status, b.refund_amount, b.created_at,
                   u.phone AS user_phone
            FROM bookings b
            LEFT JOIN user u ON u.id = b.user_id
            WHERE UPPER(b.booking_code) = :code
            LIMIT 1
            """
        ),
        {"code": raw_code},
    ).mappings().first()

    if booking is None:
        id_match = re.match(r"^(?:BG0*)?(\d+)$", raw_code)
        if id_match:
            booking = db.execute(
                text(
                    """
                    SELECT b.booking_id, b.booking_code, b.user_id, b.trip_id,
                           b.total_price, b.status, b.refund_amount, b.created_at,
                           u.phone AS user_phone
                    FROM bookings b
                    LEFT JOIN user u ON u.id = b.user_id
                    WHERE b.booking_id = :bid
                    LIMIT 1
                    """
                ),
                {"bid": int(id_match.group(1))},
            ).mappings().first()

    if booking is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy vé khớp với thông tin đã nhập")

    details = db.execute(
        text(
            """
            SELECT bd.id AS detail_id, bd.seat_id, s.seat_code,
                   bd.passenger_name, bd.passenger_phone, bd.pickup, bd.dropoff
            FROM booking_details bd
            LEFT JOIN seats s ON s.id = bd.seat_id
            WHERE bd.booking_id = :bid
            ORDER BY bd.id ASC
            """
        ),
        {"bid": booking["booking_id"]},
    ).mappings().all()

    valid_phones = {_normalize_phone(booking["user_phone"] or "")}
    for d in details:
        if d["passenger_phone"]:
            valid_phones.add(_normalize_phone(d["passenger_phone"]))
    valid_phones.discard("")

    if norm_phone not in valid_phones:
        raise HTTPException(status_code=404, detail="Số điện thoại không khớp với thông tin hành khách trên vé")

    trip = db.execute(
        text(
            """
            SELECT t.id AS trip_id, t.departure_at,
                   s1.name AS from_station, s2.name AS to_station
            FROM trips t
            LEFT JOIN routes r ON r.id = t.route_id
            LEFT JOIN stations s1 ON s1.id = r.departure_id
            LEFT JOIN stations s2 ON s2.id = r.arrival_id
            WHERE t.id = :tid
            """
        ),
        {"tid": booking["trip_id"]},
    ).mappings().first()

    return {
        "id": booking["booking_id"],
        "booking_id": booking["booking_id"],
        "booking_code": booking["booking_code"] or f"BG{booking['booking_id']:04d}",
        "status": booking["status"],
        "trip_id": booking["trip_id"],
        "departure_at": trip["departure_at"] if trip else None,
        "from_station": trip["from_station"] if trip else None,
        "to_station": trip["to_station"] if trip else None,
        "total_price": float(booking["total_price"] or 0),
        "pickup": details[0]["pickup"] if details else None,
        "dropoff": details[0]["dropoff"] if details else None,
        "passengers": [
            {
                "seat_id": d["seat_id"],
                "seat_code": d["seat_code"] or str(d["seat_id"]),
                "passenger_name": d["passenger_name"],
                "passenger_phone": d["passenger_phone"],
            }
            for d in details
        ],
    }


@router.get("/trips/{trip_id}/booked-seats")
def get_booked_seats_by_trip(trip_id: int, db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT bd.id AS detail_id,
                   b.booking_id,
                   b.booking_code,
                   bd.seat_id,
                   s.seat_code,
                   bd.passenger_name,
                   bd.passenger_phone,
                   b.total_price,
                   b.status
            FROM booking_details bd
            JOIN bookings b ON b.booking_id = bd.booking_id
            LEFT JOIN seats s ON s.id = bd.seat_id
            WHERE b.trip_id = :tid AND b.status != 'CANCELLED'
            ORDER BY s.seat_code ASC
            """
        ),
        {"tid": trip_id},
    ).mappings().all()

    return [
        {
            "detail_id": r["detail_id"],
            "booking_id": r["booking_id"],
            "booking_code": r["booking_code"] or f"BG{r['booking_id']:04d}",
            "seat_id": r["seat_id"],
            "seat_number": r["seat_code"] or str(r["seat_id"]),
            "passenger_name": r["passenger_name"],
            "passenger_phone": r["passenger_phone"],
            "status": r["status"],
        }
        for r in rows
    ]


@router.get("/{booking_id}")
def get_booking_detail(
    booking_id: int,
    user_id: Optional[int] = Query(None, description="Tùy chọn kiểm tra chủ sở hữu vé"),
    db: Session = Depends(get_db),
):
    params = {"bid": booking_id}
    where_clause = "WHERE b.booking_id = :bid"
    if user_id is not None:
        where_clause += " AND b.user_id = :uid"
        params["uid"] = user_id

    booking = db.execute(
        text(
            f"""
            SELECT b.booking_id, b.booking_code, b.user_id, b.trip_id,
                   b.total_price, b.status, b.refund_amount, b.created_at
            FROM bookings b
            {where_clause}
            LIMIT 1
            """
        ),
        params,
    ).mappings().first()

    if not booking:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin vé")

    details = db.execute(
        text(
            """
            SELECT bd.id AS detail_id, bd.seat_id, s.seat_code,
                   bd.passenger_name, bd.passenger_phone, bd.pickup, bd.dropoff
            FROM booking_details bd
            LEFT JOIN seats s ON s.id = bd.seat_id
            WHERE bd.booking_id = :bid
            ORDER BY bd.id ASC
            """
        ),
        {"bid": booking_id},
    ).mappings().all()

    trip = db.execute(
        text(
            """
            SELECT t.id AS trip_id, t.departure_at,
                   s1.name AS origin, s2.name AS destination
            FROM trips t
            LEFT JOIN routes r ON r.id = t.route_id
            LEFT JOIN stations s1 ON s1.id = r.departure_id
            LEFT JOIN stations s2 ON s2.id = r.arrival_id
            WHERE t.id = :tid
            """
        ),
        {"tid": booking["trip_id"]},
    ).mappings().first()

    return {
        "booking": dict(booking),
        "details": [dict(d) for d in details],
        "trip": dict(trip) if trip else None,
    }