"""Model = cấu trúc 1 bảng trong MySQL. Bảng mẫu: items.

Khi làm đề tài, copy file này để tạo bảng của nhóm (vd: Product, Order, Movie...).
"""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.db.session import Base

class UserRole(enum.Enum):
    ADMIN = "admin"
    USER = "user"
    GUEST = "guest"

class UserStatus(enum.Enum):
    ACTIVE = "active"
    LOCKED = "locked"


class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(10))
    password_hash: Mapped[str] = mapped_column(String(60))
    role: Mapped[UserRole] = mapped_column(default=UserRole.USER)
    status: Mapped[UserStatus] = mapped_column(default=UserStatus.ACTIVE)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
