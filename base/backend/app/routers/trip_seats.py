"""API sơ đồ ghế theo chuyến. Đường dẫn đầy đủ: GET /api/trips/{trip_id}/seats """
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.crud import seat_map as seat_map_crud
from app.db.session import get_db
from app.schemas.seat_map import SeatMapOut

router = APIRouter(prefix="/trips", tags=["Seat map"])


@router.get("/{trip_id}/seats", response_model=SeatMapOut)
def get_trip_seat_map(trip_id: int, db: Session = Depends(get_db)):
    result = seat_map_crud.get_seat_map(db, trip_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy chuyến id={trip_id}")
    return result