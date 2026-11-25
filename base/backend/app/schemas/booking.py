"""Schema cho API tạo đơn đặt vé.
"""
from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class PassengerIn(BaseModel):
    seat_id: int
    passenger_name: str = Field(min_length=1, max_length=100, examples=["Nguyễn Văn A"])
    passenger_phone: str = Field(pattern=r"^\+?\d{9,14}$", examples=["0912345678"])


class BookingCreateIn(BaseModel):
    user_id: int = Field(ge=1, examples=[1])
    booking_id: int = Field(description="booking_id nhận được khi giữ ghế", examples=[1])
    pickup: str = Field(min_length=1, max_length=255, examples=["Bến xe Mỹ Đình"])
    dropoff: str = Field(min_length=1, max_length=255, examples=["Bến xe Giáp Bát"])
    passengers: list[PassengerIn] = Field(min_length=1, max_length=5)

    @model_validator(mode="after")
    def no_duplicate_seats(self):
        ids = [p.seat_id for p in self.passengers]
        if len(ids) != len(set(ids)):
            raise ValueError("Mỗi ghế chỉ được nhập 1 hành khách")
        return self


class PassengerOut(BaseModel):
    seat_id: int
    seat_code: str
    passenger_name: str | None
    passenger_phone: str | None


class BookingOut(BaseModel):
    booking_id: int
    booking_code: str
    status: str
    trip_id: int
    departure_time: datetime | None = None
    from_station: str | None = None
    to_station: str | None = None
    payment_method: str | None = None
    paid_at: datetime | None = None
    total_price: float
    pickup: str | None
    dropoff: str | None
    hold_until: datetime | None
    hold_seconds_left: int | None
    passengers: list[PassengerOut]