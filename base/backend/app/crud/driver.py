from math import ceil
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.driver import Driver
from app.models.trip import Trip
from app.schemas.driver import DriverCreate, DriverUpdate


def get_drivers(
    db: Session,
    keyword: str | None = None,
    status: str | None = None,
    page: int = 1,
    size: int = 10,
):
    query = select(Driver)
    if keyword:
        query = query.where(
            or_(
                Driver.full_name.contains(keyword),
                Driver.phone.contains(keyword),
                Driver.license_no.contains(keyword),
            )
        )
    if status:
        query = query.where(Driver.status == status)

    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = list(
        db.scalars(
            query.order_by(Driver.id.desc())
            .offset((page - 1) * size)
            .limit(size)
        )
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "pages": ceil(total / size) if size else 0,
    }


def get_driver(db: Session, driver_id: int) -> Driver | None:
    return db.get(Driver, driver_id)


def create_driver(db: Session, data: DriverCreate) -> Driver:
    # SĐT không trùng
    if db.scalar(select(Driver).where(Driver.phone == data.phone)):
        raise HTTPException(status_code=400, detail="Số điện thoại đã tồn tại")

    # Số bằng lái không trùng
    if db.scalar(select(Driver).where(Driver.license_no == data.license_no)):
        raise HTTPException(status_code=400, detail="Số bằng lái đã tồn tại")

    driver = Driver(**data.model_dump())
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


def update_driver(db: Session, driver: Driver, data: DriverUpdate) -> Driver:
    update_data = data.model_dump(exclude_unset=True)

    if "phone" in update_data:
        existing = db.scalar(
            select(Driver).where(
                Driver.phone == update_data["phone"],
                Driver.id != driver.id,
            )
        )
        if existing:
            raise HTTPException(status_code=400, detail="Số điện thoại đã tồn tại")

    if "license_no" in update_data:
        existing = db.scalar(
            select(Driver).where(
                Driver.license_no == update_data["license_no"],
                Driver.id != driver.id,
            )
        )
        if existing:
            raise HTTPException(status_code=400, detail="Số bằng lái đã tồn tại")

    for field, value in update_data.items():
        setattr(driver, field, value)

    db.commit()
    db.refresh(driver)
    return driver


def delete_driver(db: Session, driver: Driver) -> dict:
    """Tài xế đã có chuyến → chuyển inactive; chưa có → xóa cứng."""
    has_trips = db.scalar(select(Trip.id).where(Trip.driver_id == driver.id).limit(1))

    if has_trips:
        driver.status = "inactive"
        db.commit()
        return {
            "action": "deactivated",
            "message": "Tài xế đã có chuyến, đã chuyển sang ngừng hoạt động",
        }

    db.delete(driver)
    db.commit()
    return {"action": "deleted", "message": "Đã xóa tài xế"}