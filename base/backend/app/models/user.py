from datetime import time

from sqlalchemy import Enum, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class User(Base):
    __tablename__ = "user"

    user_id: Mapped[str] = mapped_column(String(5), primary_key=True)

    email: Mapped[str] = mapped_column(String(255))
    phone: Mapped[str] = mapped_column(String(10))
    password_hash: Mapped[str] = mapped_column(String(60))
    full_name: Mapped[str] = mapped_column(String(100))

    role: Mapped[str] = mapped_column(
        Enum("admin", "staff", "customer")
    )

    status: Mapped[str] = mapped_column(
        Enum("active", "locked")
    )

    created_at: Mapped[time] = mapped_column(Time)
    updated_at: Mapped[time] = mapped_column(Time)