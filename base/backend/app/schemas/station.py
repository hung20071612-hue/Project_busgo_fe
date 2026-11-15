from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class StationBase(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    city: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    is_active: bool = True


class StationCreate(StationBase):
    pass


class StationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    city: str | None = None
    address: str | None = None
    phone: str | None = None
    is_active: bool | None = None


class StationOut(StationBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime