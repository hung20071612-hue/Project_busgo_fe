from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.trip import TripStatus


class TripFields(BaseModel):
    route_id: int = Field(gt=0)
    bus_id: int = Field(gt=0)
    driver_id: int = Field(gt=0)
    departure_at: datetime
    arrival_at: datetime
    ticket_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)

    @model_validator(mode="after")
    def arrival_after_departure(self):
        if self.arrival_at <= self.departure_at:
            raise ValueError("Giờ đến phải sau giờ đi")
        return self


class TripCreate(TripFields):
    pass


class TripUpdate(BaseModel):
    route_id: int | None = Field(default=None, gt=0)
    bus_id: int | None = Field(default=None, gt=0)
    driver_id: int | None = Field(default=None, gt=0)
    departure_at: datetime | None = None
    arrival_at: datetime | None = None
    ticket_price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    status: TripStatus | None = None

    @model_validator(mode="after")
    def valid_result(self):
        if not self.model_fields_set:
            raise ValueError("Cần có ít nhất một trường để cập nhật")
        if self.status is not None and self.status != TripStatus.CANCELLED:
            raise ValueError("Chỉ cho phép đổi trạng thái sang CANCELLED")
        return self


class TripOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    route_id: int
    bus_id: int
    driver_id: int
    departure_at: datetime
    arrival_at: datetime
    ticket_price: Decimal
    status: TripStatus
    created_at: datetime


class TripConflictOut(BaseModel):
    resource: str
    trip_id: int
    departure_at: datetime
    arrival_at: datetime


class RepeatSkippedOut(BaseModel):
    date: date
    conflicts: list[TripConflictOut]


class TripRepeatOut(BaseModel):
    created: list[TripOut]
    skipped: list[RepeatSkippedOut]
