from fastapi import APIRouter, Depends, HTTPException, Response, status
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
    values = {**{field: getattr(trip, field) for field in (
        "route_id", "bus_id", "driver_id", "departure_at", "arrival_at", "ticket_price"
    )}, **data.model_dump(exclude_unset=True, exclude={"status"})}
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
