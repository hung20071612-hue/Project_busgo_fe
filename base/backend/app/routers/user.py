from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import check_password, handle_hash_password
from app.db.session import get_db
from app.dependencies.auth_dep import get_current_user
from app.models.user import UserModel
from app.schemas.user_schema import (
    ChangePasswordRequest,
    UserProfileUpdate,
    UserResponse,
)
router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserResponse)
def get_my_profile(current_user: UserModel = Depends(get_current_user)):
    """Lấy thông tin cá nhân của tài khoản đang đăng nhập"""
    return current_user


@router.put("/me", response_model=UserResponse)
def update_my_profile(
    payload: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Cập nhật thông tin cá nhân (kiểm tra trùng email / số điện thoại)"""
    normalized_email = payload.email.lower()

    # Kiểm tra trùng email với user khác
    if normalized_email != current_user.email.lower():
        existing_email = (
            db.query(UserModel)
            .filter(
                func.lower(UserModel.email) == normalized_email,
                UserModel.id != current_user.id,
            )
            .first()
        )
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email này đã được sử dụng bởi một tài khoản khác",
            )
        current_user.email = normalized_email

    # Kiểm tra trùng SĐT nếu có gửi lên
    if payload.phone and payload.phone != current_user.phone:
        existing_phone = (
            db.query(UserModel)
            .filter(UserModel.phone == payload.phone, UserModel.id != current_user.id)
            .first()
        )
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Số điện thoại này đã được đăng ký cho tài khoản khác",
            )
        current_user.phone = payload.phone

    current_user.full_name = payload.full_name

    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password", status_code=status.HTTP_200_OK)
def change_my_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Đổi mật khẩu (bắt buộc xác thực mật khẩu cũ)"""
    # 1. Kiểm tra mật khẩu cũ
    if not check_password(payload.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu hiện tại không chính xác",
        )

    # 2. Kiểm tra xác nhận mật khẩu mới
    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu xác nhận không trùng khớp",
        )

    # 3. Không cho phép đặt lại trùng mật khẩu cũ
    if check_password(payload.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mật khẩu mới không được trùng với mật khẩu hiện tại",
        )

    # 4. Cập nhật hash mật khẩu mới
    current_user.password_hash = handle_hash_password(payload.new_password)
    db.commit()

    return {"message": "Đổi mật khẩu thành công"}