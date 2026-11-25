from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import bus_type as bus_type_crud
from app.db.session import get_db
from app.schemas.bus_type import BusTypeCreate, BusTypeOut, BusTypeUpdate
from app.schemas.seat import SeatOut
from app.dependencies.auth_dep import RoleCheck
from app.models.user import UserModel

router = APIRouter(prefix="/bus-types", tags=["Admin - Bus Types"])


def get_bus_type_or_404(bus_type_id: int, db: Session = Depends(get_db)):
    bus_type = bus_type_crud.get_bus_type(db, bus_type_id)
    if not bus_type:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy loại xe id={bus_type_id}")
    return bus_type


@router.get("", response_model=list[BusTypeOut])
def list_bus_types(
    q: str | None = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return bus_type_crud.get_bus_types(db, keyword=q, active_only=active_only)


@router.get("/{bus_type_id}", response_model=BusTypeOut)
def get_bus_type(
    bus_type=Depends(get_bus_type_or_404),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return bus_type


@router.get("/{bus_type_id}/seats", response_model=list[SeatOut])
def get_seats(
    bus_type=Depends(get_bus_type_or_404),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return bus_type_crud.get_seats_of_bus_type(db, bus_type.id)


@router.post("", response_model=BusTypeOut, status_code=status.HTTP_201_CREATED)
def create_bus_type(
    data: BusTypeCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return bus_type_crud.create_bus_type(db, data)


@router.put("/{bus_type_id}", response_model=BusTypeOut)
def update_bus_type(
    data: BusTypeUpdate,
    bus_type=Depends(get_bus_type_or_404),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return bus_type_crud.update_bus_type(db, bus_type, data)


@router.delete("/{bus_type_id}")
def delete_bus_type(
    bus_type=Depends(get_bus_type_or_404),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return bus_type_crud.delete_bus_type(db, bus_type)