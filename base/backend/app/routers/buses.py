from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.crud import bus as bus_crud
from app.db.session import get_db
from app.schemas.bus import BusCreate, BusOut, BusUpdate
from base.backend.app.schemas.pagination import PageOut
from app.dependencies.auth_dep import RoleCheck
from app.models.user import UserModel

router = APIRouter(prefix="/buses", tags=["Admin - Buses"])


def get_bus_or_404(bus_id: int, db: Session = Depends(get_db)):
    bus = bus_crud.get_bus(db, bus_id)
    if not bus:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy xe id={bus_id}")
    return bus


@router.get("", response_model=PageOut[BusOut])
def list_buses(
    q: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return bus_crud.get_buses(db, keyword=q, status=status, page=page, size=size)


@router.get("/{bus_id}", response_model=BusOut)
def get_bus(
    bus=Depends(get_bus_or_404),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return bus


@router.post("", response_model=BusOut, status_code=status.HTTP_201_CREATED)
def create_bus(
    data: BusCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return bus_crud.create_bus(db, data)


@router.put("/{bus_id}", response_model=BusOut)
def update_bus(
    data: BusUpdate,
    bus=Depends(get_bus_or_404),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return bus_crud.update_bus(db, bus, data)


@router.delete("/{bus_id}")
def delete_bus(
    bus=Depends(get_bus_or_404),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return bus_crud.delete_bus(db, bus)