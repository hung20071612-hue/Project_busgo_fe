from sqlalchemy import select, and_
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.route import Route
from app.models.trip import Trip
from app.schemas.route import RouteCreate, RouteUpdate


def get_routes(db: Session, keyword: str | None = None, active_only: bool = False):
    query = select(Route).order_by(Route.id.desc())
    if keyword:
        query = query.where(Route.code.contains(keyword))
    if active_only:
        query = query.where(Route.is_active == True)
    return list(db.scalars(query))


def get_route(db: Session, route_id: int) -> Route | None:
    return db.get(Route, route_id)


def create_route(db: Session, data: RouteCreate) -> Route:
    # Điểm đi ≠ điểm đến
    if data.departure_id == data.arrival_id:
        raise HTTPException(status_code=400, detail="Điểm đi và điểm đến không được trùng nhau")

    # Không trùng tuyến
    existing = db.scalar(
        select(Route).where(
            and_(
                Route.departure_id == data.departure_id,
                Route.arrival_id == data.arrival_id,
            )
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Tuyến này đã tồn tại")

    route = Route(**data.model_dump())
    db.add(route)
    db.commit()
    db.refresh(route)
    return route


def update_route(db: Session, route: Route, data: RouteUpdate) -> Route:
    update_data = data.model_dump(exclude_unset=True)

    new_departure = update_data.get("departure_id", route.departure_id)
    new_arrival = update_data.get("arrival_id", route.arrival_id)

    if new_departure == new_arrival:
        raise HTTPException(status_code=400, detail="Điểm đi và điểm đến không được trùng nhau")

    existing = db.scalar(
        select(Route).where(
            and_(
                Route.departure_id == new_departure,
                Route.arrival_id == new_arrival,
                Route.id != route.id,
            )
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Tuyến này đã tồn tại")

    for field, value in update_data.items():
        setattr(route, field, value)

    db.commit()
    db.refresh(route)
    return route


# def delete_route(db: Session, route: Route) -> dict:
#     """Tuyến đã có chuyến → ngừng hoạt động; chưa có → xóa cứng"""
#     has_trips = db.scalar(
#         select(Trip.id).where(Trip.route_id == route.id).limit(1)
#     )

#     if has_trips:
#         route.is_active = False
#         db.commit()
#         return {
#             "action": "deactivated",
#             "message": "Tuyến đã có chuyến, đã chuyển sang ngừng hoạt động"
#         }

#     db.delete(route)
#     db.commit()
#     return {"action": "deleted", "message": "Đã xóa tuyến"}