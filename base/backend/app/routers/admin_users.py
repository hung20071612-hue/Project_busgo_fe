from typing import Optional
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import UserModel

# Lưu ý: Nếu trong app/main.py đã ghi app.include_router(admin_users.router, prefix="/api")
# thì đổi prefix bên dưới thành prefix="/users" để tránh bị lặp /api/api/users
router = APIRouter(prefix="/api/users", tags=["Admin - Users"])


class UserCreateSchema(BaseModel):
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role: str = "USER"
    is_active: bool = True


class UserUpdateSchema(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


def hash_pwd(raw_password: str) -> str:
    return bcrypt.hashpw(raw_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def serialize_user(user: UserModel) -> dict:
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    return {
        "id": user.id,
        "full_name": getattr(user, "full_name", None) or getattr(user, "name", ""),
        "email": user.email,
        "phone": getattr(user, "phone", None),
        "role": role_val,
        "is_active": getattr(user, "is_active", True),
    }


@router.get("")
def list_users(db: Session = Depends(get_db)):
    users = db.query(UserModel).all()
    return [serialize_user(u) for u in users]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreateSchema, db: Session = Depends(get_db)):
    existed = db.query(UserModel).filter(UserModel.email == payload.email).first()
    if existed:
        raise HTTPException(status_code=400, detail="Email đã tồn tại trong hệ thống")

    user = UserModel(email=payload.email)
    if hasattr(user, "full_name"):
        user.full_name = payload.full_name
    elif hasattr(user, "name"):
        user.name = payload.full_name

    if hasattr(user, "phone"):
        user.phone = payload.phone
    if hasattr(user, "role"):
        user.role = payload.role.upper()
    if hasattr(user, "is_active"):
        user.is_active = payload.is_active

    hashed = hash_pwd(payload.password)
    if hasattr(user, "hashed_password"):
        user.hashed_password = hashed
    elif hasattr(user, "password_hash"):
        user.password_hash = hashed
    elif hasattr(user, "password"):
        user.password = hashed

    db.add(user)
    db.commit()
    db.refresh(user)
    return serialize_user(user)


@router.put("/{user_id}")
def update_user(user_id: int, payload: UserUpdateSchema, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    if payload.full_name is not None:
        if hasattr(user, "full_name"):
            user.full_name = payload.full_name
        elif hasattr(user, "name"):
            user.name = payload.full_name

    if payload.email is not None:
        user.email = payload.email
    if payload.phone is not None and hasattr(user, "phone"):
        user.phone = payload.phone
    if payload.role is not None and hasattr(user, "role"):
        user.role = payload.role.upper()
    if payload.is_active is not None and hasattr(user, "is_active"):
        user.is_active = payload.is_active

    if payload.password:
        hashed = hash_pwd(payload.password)
        if hasattr(user, "hashed_password"):
            user.hashed_password = hashed
        elif hasattr(user, "password_hash"):
            user.password_hash = hashed
        elif hasattr(user, "password"):
            user.password = hashed

    db.commit()
    db.refresh(user)
    return serialize_user(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    db.delete(user)
    db.commit()
    return None