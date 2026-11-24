from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.dependencies.auth_dep import RoleCheck
from app.models.user import UserModel
from app.schemas.user_schema import (
    PaginatedUserResponse,
    StaffCreateRequest,
    UserResponse,
    UserStatsResponse,
    UserStatusUpdateRequest,
)
from app.services import user_service

router = APIRouter(
    prefix="/users",
    tags=["Admin - Users"],
)


@router.get(
    "/stats",
    response_model=UserStatsResponse,
    dependencies=[Depends(RoleCheck(["ADMIN"]))],
)
def get_admin_user_stats(db: Session = Depends(get_db)):
    """Thống kê tổng quan tài khoản cho trang quản trị"""
    return user_service.get_user_stats(db)


@router.get(
    "",
    response_model=PaginatedUserResponse,
    dependencies=[Depends(RoleCheck(["ADMIN"]))],
)
def get_admin_users(
    page: int = Query(1, ge=1, description="Trang hiện tại"),
    page_size: int = Query(10, ge=1, le=100, description="Số bản ghi mỗi trang"),
    q: str | None = Query(None, description="Tìm theo tên, email, SĐT hoặc mã"),
    role: str | None = Query(None, description="Lọc theo role: user, staff, admin"),
    status_filter: str | None = Query(
        None, alias="status", description="Lọc theo trạng thái: active, locked"
    ),
    db: Session = Depends(get_db),
):
    """Danh sách người dùng phân trang, tìm kiếm và lọc"""
    return user_service.list_users_paginated(
        db=db,
        page=page,
        page_size=page_size,
        q=q,
        role=role,
        user_status=status_filter,
    )


@router.post(
    "/staff",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(RoleCheck(["ADMIN"]))],
)
def create_staff_user(
    payload: StaffCreateRequest,
    db: Session = Depends(get_db),
):
    """Admin tạo tài khoản nhân viên mới (role = staff)"""
    return user_service.create_staff_account(db=db, payload=payload)


@router.patch(
    "/{user_id}/status",
    response_model=UserResponse,
)
def toggle_user_status(
    user_id: int,
    payload: UserStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: UserModel = Depends(RoleCheck(["ADMIN"])),
):
    """Khóa hoặc mở khóa tài khoản người dùng (locked sẽ không đăng nhập được)"""
    return user_service.update_user_account_status(
        db=db,
        target_user_id=user_id,
        new_status=payload.status,
        current_admin_id=current_admin.id,
    )