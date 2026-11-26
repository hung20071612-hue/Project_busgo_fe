from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import station as station_crud
from app.db.session import get_db
from app.schemas.station import StationCreate, StationOut, StationUpdate

router = APIRouter(prefix="/stations", tags=["Admin - Stations"])


def get_station_or_404(station_id: int, db: Session = Depends(get_db)):
    station = station_crud.get_station(db, station_id)
    if not station:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bến xe id={station_id}")
    return station


@router.get("", response_model=list[StationOut])
def list_stations(q: str | None = None, active_only: bool = False, db: Session = Depends(get_db)):
    return station_crud.get_stations(db, keyword=q, active_only=active_only)


@router.get("/{station_id}", response_model=StationOut)
def get_station(station=Depends(get_station_or_404)):
    return station


@router.post("", response_model=StationOut, status_code=status.HTTP_201_CREATED)
def create_station(data: StationCreate, db: Session = Depends(get_db)):
    return station_crud.create_station(db, data)


@router.put("/{station_id}", response_model=StationOut)
def update_station(data: StationUpdate, station=Depends(get_station_or_404), db: Session = Depends(get_db)):
    return station_crud.update_station(db, station, data)


@router.delete("/{station_id}")
def delete_station(station=Depends(get_station_or_404), db: Session = Depends(get_db)):
    return station_crud.delete_station(db, station)