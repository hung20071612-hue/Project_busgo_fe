import math
import re
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.security import handle_hash_password
from app.models.user import UserModel, UserRole, UserStatus
from app.schemas.user_schema import StaffCreateRequest


def handle_get_me(user_id: int, db: Session):
    return db.query(UserModel).filter(UserModel.id == user_id).first()


def get_user_stats(db: Session) -> dict:
    total_users = db.scalar(select(func.count(UserModel.id))) or 0
    customer_count = (
        db.scalar(select(func.count(UserModel.id)).where(UserModel.role == UserRole.USER))
        or 0
    )
    staff_count = (
        db.scalar(select(func.count(UserModel.id)).where(UserModel.role == UserRole.STAFF))
        or 0
    )
    admin_count = (
        db.scalar(select(func.count(UserModel.id)).where(UserModel.role == UserRole.ADMIN))
        or 0
    )
    locked_count = (
        db.scalar(
            select(func.count(UserModel.id)).where(UserModel.status == UserStatus.LOCKED)
        )
        or 0
    )
    new_today_count = (
        db.scalar(
            select(func.count(UserModel.id)).where(
                func.date(UserModel.created_at) == func.current_date()
            )
        )
        or 0
    )

    return {
        "total_users": total_users,
        "customer_count": customer_count,
        "staff_count": staff_count,
        "admin_count": admin_count,
        "locked_count": locked_count,
        "new_today_count": new_today_count,
    }


def list_users_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    q: str | None = None,
    role: str | None = None,
    user_status: str | None = None,
) -> dict:
    query = select(UserModel)

    # 1. Tìm kiếm theo tên / email / SĐT / mã hiển thị (VD: NV-12, KH-5, 12)
    if q and q.strip():
        keyword = q.strip()
        like_pattern = f"%{keyword.lower()}%"
        conditions = [
            func.lower(UserModel.full_name).like(like_pattern),
            func.lower(UserModel.email).like(like_pattern),
            UserModel.phone.like(f"%{keyword.replace(' ', '')}%"),
        ]

        code_match = re.match(r"^(?:nv|ad|kh|tx)?-?(\d+)$", keyword.lower())
        if code_match:
            conditions.append(UserModel.id == int(code_match.group(1)))

        query = query.where(or_(*conditions))

    # 2. Lọc theo vai trò (USER / STAFF / ADMIN)
    if role and role.strip() and role.strip().upper() != "ALL":
        normalized_role = role.strip().lower()
        try:
            role_enum = UserRole(normalized_role)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vai trò lọc không hợp lệ (chấp nhận: user, staff, admin)",
            )
        query = query.where(UserModel.role == role_enum)

    # 3. Lọc theo trạng thái (ACTIVE / LOCKED)
    if user_status and user_status.strip() and user_status.strip().upper() != "ALL":
        normalized_status = user_status.strip().lower()
        try:
            status_enum = UserStatus(normalized_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Trạng thái lọc không hợp lệ (chấp nhận: active, locked)",
            )
        query = query.where(UserModel.status == status_enum)

    # 4. Đếm tổng & phân trang
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    items = list(
        db.scalars(query.order_by(UserModel.id.desc()).offset(offset).limit(page_size))
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def create_staff_account(db: Session, payload: StaffCreateRequest) -> UserModel:
    normalized_email = payload.email.lower().strip()

    existing_email = db.scalar(
        select(UserModel).where(func.lower(UserModel.email) == normalized_email)
    )
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email này đã tồn tại trong hệ thống",
        )

    existing_phone = db.scalar(
        select(UserModel).where(UserModel.phone == payload.phone)
    )
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Số điện thoại này đã được đăng ký cho tài khoản khác",
        )

    new_staff = UserModel(
        full_name=payload.full_name,
        email=normalized_email,
        phone=payload.phone,
        password_hash=handle_hash_password(payload.password),
        role=UserRole.STAFF,
        status=UserStatus.ACTIVE,
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff


def update_user_account_status(
    db: Session,
    target_user_id: int,
    new_status: str,
    current_admin_id: int,
) -> UserModel:
    target_user = db.get(UserModel, target_user_id)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy người dùng id={target_user_id}",
        )

    status_enum = UserStatus(new_status)
    if target_user.id == current_admin_id and status_enum == UserStatus.LOCKED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn không thể tự khóa tài khoản quản trị của chính mình",
        )

    target_user.status = status_enum
    db.commit()
    db.refresh(target_user)
    return target_user