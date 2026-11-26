from sqlalchemy.orm import Session

from app.models.user import UserModel, UserRole, UserStatus
from app.schemas.auth_schema import RegisterRequest, LoginRequest
from app.core import security

FOUND_USER = "Tài khoản email đã tồn tại"
PHONE_USER = "Số điện thoại đã tồn tại"
NOT_FOUND_USER = "Email không tồn tại"
INCORRECT_PASSWORD = "Mật khẩu không chính xác"
ACCOUNT_LOCKED = "Tài khoản đang bị khóa"


def handle_register(req: RegisterRequest, db: Session):
    user = db.query(UserModel).filter(UserModel.email == req.email).first()
    if user:
        return FOUND_USER

    user = db.query(UserModel).filter(UserModel.phone == req.phone).first()
    if user:
        return PHONE_USER

    hashed_password = security.handle_hash_password(req.password)
    new_account = UserModel(
        email=req.email,
        password_hash=hashed_password,
        full_name=req.full_name,
        phone=req.phone,
        role=UserRole.USER
    )
    db.add(new_account)
    db.commit()
    db.refresh(new_account)
    return new_account


def handle_login(req: LoginRequest, db: Session):
    user = db.query(UserModel).filter(UserModel.email == req.email).first()
    if not user:
        return NOT_FOUND_USER, None

    if user.status == UserStatus.LOCKED:
        return ACCOUNT_LOCKED, None

    is_valid_password = security.check_password(req.password, user.password_hash)
    if not is_valid_password:
        return INCORRECT_PASSWORD, None

    access_token = security.create_access_token(
        user_id=user.id,
        username=user.email,
        role_user=user.role
    )

    return None, access_token