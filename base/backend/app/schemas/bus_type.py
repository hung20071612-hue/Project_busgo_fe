from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class SeatTypeEnum(str, Enum):
    seat = "seat"
    berth = "berth"


class BusTypeBase(BaseModel):
    name: str = Field(min_length=1, max_length=100, examples=["Giường nằm 40 chỗ"])
    floors: int = Field(default=1, ge=1, le=2)
    rows_per_floor: int = Field(ge=1, examples=[10])
    cols_per_floor: int = Field(ge=1, le=6, examples=[2])
    seat_type: SeatTypeEnum = SeatTypeEnum.seat
    description: str | None = Field(default=None, max_length=255)
    is_active: bool = True


class BusTypeCreate(BusTypeBase):
    """Khi tạo sẽ tự tính total_seats và sinh ghế."""
    pass


class BusTypeUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    floors: int | None = Field(default=None, ge=1, le=2)
    rows_per_floor: int | None = Field(default=None, ge=1)
    cols_per_floor: int | None = Field(default=None, ge=1, le=6)
    seat_type: SeatTypeEnum | None = None
    description: str | None = None
    is_active: bool | None = None


class BusTypeOut(BusTypeBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    total_seats: int
    created_at: datetime
    updated_at: datetime