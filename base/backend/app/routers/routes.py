from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import route as route_crud
from app.db.session import get_db
from app.schemas.route import RouteCreate, RouteOut, RouteUpdate

router = APIRouter(prefix="/routes", tags=["Admin - Routes"])


def get_route_or_404(route_id: int, db: Session = Depends(get_db)):
    route = route_crud.get_route(db, route_id)
    if not route:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy tuyến id={route_id}")
    return route


@router.get("", response_model=list[RouteOut])
def list_routes(q: str | None = None, active_only: bool = False, db: Session = Depends(get_db)):
    return route_crud.get_routes(db, keyword=q, active_only=active_only)


@router.get("/{route_id}", response_model=RouteOut)
def get_route(route=Depends(get_route_or_404)):
    return route


@router.post("", response_model=RouteOut, status_code=status.HTTP_201_CREATED)
def create_route(data: RouteCreate, db: Session = Depends(get_db)):
    return route_crud.create_route(db, data)


@router.put("/{route_id}", response_model=RouteOut)
def update_route(data: RouteUpdate, route=Depends(get_route_or_404), db: Session = Depends(get_db)):
    return route_crud.update_route(db, route, data)


@router.delete("/{route_id}")
def delete_route(route=Depends(get_route_or_404), db: Session = Depends(get_db)):
    return route_crud.delete_route(db, route)