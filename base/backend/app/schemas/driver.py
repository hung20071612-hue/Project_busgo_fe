from datetime import date, datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class DriverStatusEnum(str, Enum):
    active = "active"
    inactive = "inactive"
    on_leave = "on_leave"


class DriverBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=1, max_length=20)
    license_no: str = Field(min_length=1, max_length=50)
    license_class: str | None = Field(default=None, max_length=10)
    status: DriverStatusEnum = DriverStatusEnum.active
    hired_date: date | None = None
    note: str | None = Field(default=None, max_length=255)


class DriverCreate(DriverBase):
    pass


class DriverUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=150)
    phone: str | None = Field(default=None, min_length=1, max_length=20)
    license_no: str | None = Field(default=None, min_length=1, max_length=50)
    license_class: str | None = None
    status: DriverStatusEnum | None = None
    hired_date: date | None = None
    note: str | None = None


class DriverOut(DriverBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime