from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class RouteBase(BaseModel):
    code: str = Field(min_length=1, max_length=20)
    departure_id: int
    arrival_id: int
    distance_km: Decimal = Field(gt=0)
    estimated_time: int = Field(gt=0)  # phút
    base_price: Decimal = Field(default=0, ge=0)
    is_active: bool = True


class RouteCreate(RouteBase):
    pass


class RouteUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=1, max_length=20)
    departure_id: int | None = None
    arrival_id: int | None = None
    distance_km: Decimal | None = Field(default=None, gt=0)
    estimated_time: int | None = Field(default=None, gt=0)
    base_price: Decimal | None = Field(default=None, ge=0)
    is_active: bool | None = None


class RouteOut(RouteBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime