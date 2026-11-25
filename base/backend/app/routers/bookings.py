from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.crud import booking as booking_crud
from app.db.session import get_db
from app.schemas.booking import BookingCreateIn, BookingOut

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.get("")
def list_user_bookings(
    user_id: int = Query(..., ge=1, description="ID người dùng"),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT b.booking_id,
                   b.booking_code,
                   b.user_id,
                   b.trip_id,
                   b.total_price,
                   b.status,
                   b.refund_amount,
                   b.created_at,
                   t.departure_at,
                   s1.name AS origin,
                   s2.name AS destination,
                   bt.name AS bus_type_name
            FROM bookings b
            LEFT JOIN trips t ON t.id = b.trip_id
            LEFT JOIN routes r ON r.id = t.route_id
            LEFT JOIN stations s1 ON s1.id = r.departure_id
            LEFT JOIN stations s2 ON s2.id = r.arrival_id
            LEFT JOIN buses bs ON bs.id = t.bus_id
            LEFT JOIN bus_types bt ON bt.id = bs.bus_type_id
            WHERE b.user_id = :uid
            ORDER BY b.created_at DESC, b.booking_id DESC
            """
        ),
        {"uid": user_id},
    ).mappings().all()

    results = []
    for row in rows:
        bid = row["booking_id"]
        details = db.execute(
            text(
                """
                SELECT bd.id AS detail_id,
                       bd.seat_id,
                       s.seat_code,
                       bd.passenger_name,
                       bd.passenger_phone,
                       bd.pickup,
                       bd.dropoff
                FROM booking_details bd
                LEFT JOIN seats s ON s.id = bd.seat_id
                WHERE bd.booking_id = :bid
                ORDER BY bd.id ASC
                """
            ),
            {"bid": bid},
        ).mappings().all()

        results.append(
            {
                "id": bid,
                "booking_id": bid,
                "booking_code": row["booking_code"] or f"BG{bid:04d}",
                "user_id": row["user_id"],
                "trip_id": row["trip_id"],
                "total_price": float(row["total_price"] or 0),
                "total_amount": float(row["total_price"] or 0),
                "status": row["status"],
                "refund_amount": float(row["refund_amount"] or 0),
                "created_at": row["created_at"],
                "origin": row["origin"],
                "destination": row["destination"],
                "departure_time": row["departure_at"],
                "trip": {
                    "id": row["trip_id"],
                    "origin": row["origin"],
                    "destination": row["destination"],
                    "departure_time": row["departure_at"],
                    "bus_type_name": row["bus_type_name"],
                },
                "details": [
                    {
                        "detail_id": d["detail_id"],
                        "seat_id": d["seat_id"],
                        "seat_code": d["seat_code"] or str(d["seat_id"]),
                        "seat_number": d["seat_code"] or str(d["seat_id"]),
                        "passenger_name": d["passenger_name"],
                        "passenger_phone": d["passenger_phone"],
                        "pickup": d["pickup"],
                        "dropoff": d["dropoff"],
                    }
                    for d in details
                ],
            }
        )

    return results


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


@router.get("/{booking_id}/checkout", response_model=BookingOut)
def get_booking_checkout(
    booking_id: int,
    user_id: int = Query(..., ge=1),
    db: Session = Depends(get_db),
):
    try:
        return booking_crud.get_booking(db, booking_id, user_id)
    except booking_crud.BookingError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message)