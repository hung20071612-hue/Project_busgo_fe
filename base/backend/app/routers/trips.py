from datetime import date, datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.crud import trip as trip_crud
from app.db.session import get_db
from app.schemas.trip import TripCreate, TripOut, TripUpdate

router = APIRouter(prefix="/trips", tags=["Trips"])


def get_trip_or_404(trip_id: int, db: Session) -> object:
    trip = trip_crud.get_trip(db, trip_id)
    if trip is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy chuyến xe id={trip_id}")
    return trip


def _enrich_trip_row(db: Session, row: dict) -> dict:
    occupied = db.execute(
        text(
            """
            SELECT COUNT(DISTINCT bd.seat_id)
            FROM booking_details bd
            JOIN bookings b ON b.booking_id = bd.booking_id
            WHERE bd.trip_id = :tid
              AND (
                  b.status = 'PAID'
                  OR (b.status = 'PENDING_PAYMENT' AND bd.hold_until IS NOT NULL AND bd.hold_until > NOW())
              )
            """
        ),
        {"tid": row["id"]},
    ).scalar() or 0

    total_seats = int(row.get("total_seats") or 0)
    available_seats = max(0, total_seats - int(occupied))
    origin_city = row.get("origin_city") or row.get("origin_station") or ""
    dest_city = row.get("dest_city") or row.get("dest_station") or ""

    return {
        "id": row["id"],
        "route_id": row["route_id"],
        "route_code": row["route_code"],
        "bus_id": row["bus_id"],
        "driver_id": row["driver_id"],
        "departure_at": row["departure_at"],
        "arrival_at": row["arrival_at"],
        "ticket_price": float(row["ticket_price"]),
        "status": row["status"],
        "origin": f"{origin_city} ({row['origin_station']})" if origin_city and origin_city != row["origin_station"] else row["origin_station"],
        "destination": f"{dest_city} ({row['dest_station']})" if dest_city and dest_city != row["dest_station"] else row["dest_station"],
        "origin_station": row["origin_station"],
        "dest_station": row["dest_station"],
        "origin_address": row.get("origin_address"),
        "dest_address": row.get("dest_address"),
        "distance_km": float(row["distance_km"]) if row.get("distance_km") is not None else None,
        "estimated_time": row.get("estimated_time"),
        "plate_number": row["plate_number"],
        "bus_type_name": row["bus_type_name"],
        "seat_type": row["seat_type"],
        "driver_name": row["driver_name"],
        "total_seats": total_seats,
        "available_seats": available_seats,
    }


@router.get("/search")
def search_trips(
    origin: str = Query(..., min_length=1),
    destination: str = Query(..., min_length=1),
    travel_date: date = Query(...),
    min_price: Decimal | None = Query(default=None, ge=0),
    max_price: Decimal | None = Query(default=None, ge=0),
    time_from: time | None = Query(default=None),
    time_to: time | None = Query(default=None),
    sort: str = Query(default="departure_asc"),
    db: Session = Depends(get_db),
):
    start_dt = datetime.combine(travel_date, time_from or time.min)
    end_dt = datetime.combine(travel_date, time_to or time.max)

    order_map = {
        "departure_asc": "t.departure_at ASC",
        "departure_desc": "t.departure_at DESC",
        "price_asc": "t.ticket_price ASC, t.departure_at ASC",
        "price_desc": "t.ticket_price DESC, t.departure_at ASC",
    }
    order_clause = order_map.get(sort, "t.departure_at ASC")

    sql = f"""
        SELECT
            t.id, t.route_id, t.bus_id, t.driver_id,
            t.departure_at, t.arrival_at, t.ticket_price, t.status,
            r.code AS route_code, r.distance_km, r.estimated_time,
            s1.name AS origin_station, s1.city AS origin_city, s1.address AS origin_address,
            s2.name AS dest_station, s2.city AS dest_city, s2.address AS dest_address,
            b.plate_number,
            bt.name AS bus_type_name, bt.total_seats, bt.seat_type,
            d.full_name AS driver_name
        FROM trips t
        JOIN routes r ON r.id = t.route_id
        JOIN stations s1 ON s1.id = r.departure_id
        JOIN stations s2 ON s2.id = r.arrival_id
        JOIN buses b ON b.id = t.bus_id
        JOIN bus_types bt ON bt.id = b.bus_type_id
        JOIN drivers d ON d.id = t.driver_id
        WHERE t.status = 'SCHEDULED'
          AND t.departure_at >= :start_dt
          AND t.departure_at <= :end_dt
          AND (s1.name LIKE :origin OR s1.city LIKE :origin)
          AND (s2.name LIKE :destination OR s2.city LIKE :destination)
          {"AND t.ticket_price >= :min_price" if min_price is not None else ""}
          {"AND t.ticket_price <= :max_price" if max_price is not None else ""}
        ORDER BY {order_clause}
    """

    params = {
        "start_dt": start_dt,
        "end_dt": end_dt,
        "origin": f"%{origin.strip()}%",
        "destination": f"%{destination.strip()}%",
    }
    if min_price is not None:
        params["min_price"] = min_price
    if max_price is not None:
        params["max_price"] = max_price

    rows = db.execute(text(sql), params).mappings().all()
    results = [_enrich_trip_row(db, dict(r)) for r in rows]
    return [item for item in results if item["available_seats"] > 0]


@router.get("/options")
def get_trip_options(db: Session = Depends(get_db)):
    routes = db.execute(
        text(
            """
            SELECT r.id, r.code, s1.name AS origin, s2.name AS destination, r.base_price
            FROM routes r
            JOIN stations s1 ON s1.id = r.departure_id
            JOIN stations s2 ON s2.id = r.arrival_id
            WHERE r.is_active = 1
            ORDER BY r.code
            """
        )
    ).mappings().all()

    buses = db.execute(
        text(
            """
            SELECT b.id, b.plate_number, bt.name AS bus_type_name, bt.total_seats AS seat_count
            FROM buses b
            JOIN bus_types bt ON bt.id = b.bus_type_id
            WHERE b.status = 'active'
            ORDER BY b.plate_number
            """
        )
    ).mappings().all()

    drivers = db.execute(
        text("SELECT id, full_name, phone FROM drivers WHERE status = 'active' ORDER BY full_name")
    ).mappings().all()

    return {
        "routes": [dict(r) for r in routes],
        "buses": [dict(b) for b in buses],
        "drivers": [dict(d) for d in drivers],
    }


@router.get("/{trip_id}/details")
def get_trip_details(trip_id: int, db: Session = Depends(get_db)):
    row = db.execute(
        text(
            """
            SELECT
                t.id, t.route_id, t.bus_id, t.driver_id,
                t.departure_at, t.arrival_at, t.ticket_price, t.status,
                r.code AS route_code, r.distance_km, r.estimated_time,
                s1.name AS origin_station, s1.city AS origin_city, s1.address AS origin_address,
                s2.name AS dest_station, s2.city AS dest_city, s2.address AS dest_address,
                b.plate_number,
                bt.name AS bus_type_name, bt.total_seats, bt.seat_type,
                d.full_name AS driver_name
            FROM trips t
            JOIN routes r ON r.id = t.route_id
            JOIN stations s1 ON s1.id = r.departure_id
            JOIN stations s2 ON s2.id = r.arrival_id
            JOIN buses b ON b.id = t.bus_id
            JOIN bus_types bt ON bt.id = b.bus_type_id
            JOIN drivers d ON d.id = t.driver_id
            WHERE t.id = :tid
            """
        ),
        {"tid": trip_id},
    ).mappings().first()

    if row is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy chuyến xe id={trip_id}")

    return _enrich_trip_row(db, dict(row))


@router.get("", response_model=list[TripOut])
def list_trips(db: Session = Depends(get_db)):
    return trip_crud.list_trips(db)


@router.get("/{trip_id}", response_model=TripOut)
def get_trip(trip_id: int, db: Session = Depends(get_db)):
    return get_trip_or_404(trip_id, db)


def validate_references(db: Session, route_id: int, bus_id: int, driver_id: int) -> None:
    error = trip_crud.validate_references(db, route_id, bus_id, driver_id)
    if error:
        raise HTTPException(status_code=422, detail=error)


@router.post("", response_model=TripOut, status_code=status.HTTP_201_CREATED)
def create_trip(data: TripCreate, db: Session = Depends(get_db)):
    validate_references(db, data.route_id, data.bus_id, data.driver_id)
    return trip_crud.create_trip(db, data)


@router.put("/{trip_id}", response_model=TripOut)
def update_trip(trip_id: int, data: TripUpdate, db: Session = Depends(get_db)):
    trip = get_trip_or_404(trip_id, db)
    values = {
        **{field: getattr(trip, field) for field in ("route_id", "bus_id", "driver_id", "departure_at", "arrival_at", "ticket_price")},
        **data.model_dump(exclude_unset=True, exclude={"status"}),
    }
    if values["arrival_at"] <= values["departure_at"]:
        raise HTTPException(status_code=422, detail="Giờ đến phải sau giờ đi")
    validate_references(db, values["route_id"], values["bus_id"], values["driver_id"])
    return trip_crud.update_trip(db, trip, data)


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(trip_id: int, db: Session = Depends(get_db)):
    trip = get_trip_or_404(trip_id, db)
    if trip_crud.has_bookings(db, trip_id):
        raise HTTPException(status_code=409, detail="Chuyến đã có vé, không thể xoá; hãy huỷ chuyến")
    trip_crud.delete_trip(db, trip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)