from datetime import datetime
import re
from typing import Optional, Literal
from pydantic import ConfigDict
from pydantic import BaseModel, EmailStr, Field, field_validator

class UserResponse(BaseModel):
    id: int
    email: str
    phone: str
    full_name: str
    role: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

class UserProfileUpdate(BaseModel):
    full_name: str = Field(..., min_length=5, max_length=100, description="Họ và tên")
    email: EmailStr = Field(..., description="Email nhận vé điện tử")
    phone: Optional[str] = Field(None, description="Số điện thoại 10 chữ số")

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 5:
            raise ValueError("Họ và tên phải có ít nhất 5 ký tự")
        return cleaned

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v.strip() == "":
            return None
        cleaned = v.replace(" ", "").strip()
        if not re.match(r"^0[0-9]{9}$", cleaned):
            raise ValueError("Số điện thoại phải bắt đầu bằng số 0 và gồm đúng 10 chữ số")
        return cleaned


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=1, description="Mật khẩu hiện tại")
    new_password: str = Field(..., min_length=8, max_length=128, description="Mật khẩu mới")
    confirm_password: str = Field(..., min_length=8, max_length=128, description="Xác nhận mật khẩu mới")

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Mật khẩu mới phải có tối thiểu 8 ký tự")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Mật khẩu mới phải chứa ít nhất 1 chữ cái in hoa")
        if not re.search(r"[0-9]", v):
            raise ValueError("Mật khẩu mới phải chứa ít nhất 1 chữ số")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\;/~`]", v):
            raise ValueError("Mật khẩu mới phải chứa ít nhất 1 ký tự đặc biệt")
        return v

class PaginatedUserResponse(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class StaffCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=5, max_length=100, description="Họ và tên nhân viên")
    email: EmailStr = Field(..., description="Email nội bộ nhân viên")
    phone: str = Field(..., description="Số điện thoại 10 chữ số")
    password: str = Field(..., min_length=8, max_length=128, description="Mật khẩu khởi tạo")

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 5:
            raise ValueError("Họ và tên phải có ít nhất 5 ký tự")
        return cleaned

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = v.replace(" ", "").strip()
        if not re.match(r"^0[0-9]{9}$", cleaned):
            raise ValueError("Số điện thoại phải bắt đầu bằng số 0 và gồm đúng 10 chữ số")
        return cleaned

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Mật khẩu phải chứa ít nhất 1 chữ cái in hoa")
        if not re.search(r"[0-9]", v):
            raise ValueError("Mật khẩu phải chứa ít nhất 1 chữ số")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\;/~`]", v):
            raise ValueError("Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt")
        return v


class UserStatusUpdateRequest(BaseModel):
    status: Literal["active", "locked"]

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v: str) -> str:
        if isinstance(v, str):
            return v.strip().lower()
        return v


class UserStatsResponse(BaseModel):
    total_users: int
    customer_count: int
    staff_count: int
    admin_count: int
    locked_count: int
    new_today_count: int