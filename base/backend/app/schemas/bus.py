from datetime import datetime
from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class BusStatusEnum(str, Enum):
    active = "active"
    maintenance = "maintenance"
    retired = "retired"


class BusBase(BaseModel):
    plate_number: str = Field(min_length=1, max_length=20, examples=["29B-12345"])
    bus_type_id: int
    status: BusStatusEnum = BusStatusEnum.active
    note: str | None = Field(default=None, max_length=255)


class BusCreate(BusBase):
    pass


class BusUpdate(BaseModel):
    plate_number: str | None = Field(default=None, min_length=1, max_length=20)
    bus_type_id: int | None = None
    status: BusStatusEnum | None = None
    note: str | None = None


class BusOut(BusBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime