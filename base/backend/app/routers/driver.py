from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.crud import driver as driver_crud
from app.db.session import get_db
from app.schemas.driver import DriverCreate, DriverOut, DriverUpdate
from base.backend.app.schemas.pagination import PageOut
from app.dependencies.auth_dep import RoleCheck
from app.models.user import UserModel

router = APIRouter(prefix="/drivers", tags=["Admin - Drivers"])


def get_driver_or_404(driver_id: int, db: Session = Depends(get_db)):
    driver = driver_crud.get_driver(db, driver_id)
    if not driver:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy tài xế id={driver_id}")
    return driver


@router.get("", response_model=PageOut[DriverOut])
def list_drivers(
    q: str | None = None,
    status: str | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return driver_crud.get_drivers(db, keyword=q, status=status, page=page, size=size)


@router.get("/{driver_id}", response_model=DriverOut)
def get_driver(
    driver=Depends(get_driver_or_404),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return driver


@router.post("", response_model=DriverOut, status_code=status.HTTP_201_CREATED)
def create_driver(
    data: DriverCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return driver_crud.create_driver(db, data)


@router.put("/{driver_id}", response_model=DriverOut)
def update_driver(
    data: DriverUpdate,
    driver=Depends(get_driver_or_404),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return driver_crud.update_driver(db, driver, data)


@router.delete("/{driver_id}")
def delete_driver(
    driver=Depends(get_driver_or_404),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    return driver_crud.delete_driver(db, driver)