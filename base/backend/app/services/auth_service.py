from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
from sqlalchemy.orm import Session

from app.core import security
from app.core.config import settings
from app.db.session import get_db
from app.models.user import UserModel, UserRole, UserStatus
from app.schemas.auth_schema import LoginRequest, RegisterRequest

FOUND_USER = "Tài khoản email đã tồn tại"
PHONE_USER = "Số điện thoại đã tồn tại"
NOT_FOUND_USER = "Email không tồn tại"
INCORRECT_PASSWORD = "Mật khẩu không chính xác"
ACCOUNT_LOCKED = "Tài khoản đang bị khóa"


def handle_register(req: RegisterRequest, db: Session):
    normalized_email = req.email.strip().lower()
    user = db.query(UserModel).filter(UserModel.email == normalized_email).first()
    if user:
        return FOUND_USER

    user = db.query(UserModel).filter(UserModel.phone == req.phone).first()
    if user:
        return PHONE_USER

    hashed_password = security.handle_hash_password(req.password)
    new_account = UserModel(
        email=normalized_email,
        password_hash=hashed_password,
        full_name=req.full_name.strip(),
        phone=req.phone,
        role=UserRole.USER,
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return new_account


def handle_login(req: LoginRequest, db: Session):
    normalized_email = req.email.strip().lower()
    user = db.query(UserModel).filter(UserModel.email == normalized_email).first()
    if not user:
        return NOT_FOUND_USER, None

    if user.status == UserStatus.LOCKED:
        return ACCOUNT_LOCKED, None

    is_valid_password = security.check_password(req.password, user.password_hash)
    if not is_valid_password:
        return INCORRECT_PASSWORD, None

    role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
    access_token = security.create_access_token(
        user_id=user.id,
        username=user.email,
        role_user=role_value,
    )

    return None, access_token


security_token = HTTPBearer()


def handle_get_user(
    cre: HTTPAuthorizationCredentials = Depends(security_token),
    db: Session = Depends(get_db),
):
    token = cre.credentials
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        raw_sub = payload.get("sub")
        if not raw_sub:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ")
        user_id = int(raw_sub)
        user = db.query(UserModel).filter(UserModel.id == user_id).first()
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tài khoản không tồn tại")
        if user.status == UserStatus.LOCKED:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tài khoản đã bị khóa")
        role_value = user.role.value if hasattr(user.role, "value") else str(user.role)
        return {
            "user_id": user.id,
            "username": user.email,
            "role_name": role_value,
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token đã hết hạn, vui lòng đăng nhập lại")
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token không hợp lệ")