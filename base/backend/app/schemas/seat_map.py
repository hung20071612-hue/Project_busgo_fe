"""Schema cho API sơ đồ ghế theo chuyến.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

SeatStatus = Literal["AVAILABLE", "BOOKED", "HELD"]


class SeatOut(BaseModel):
    seat_id: int
    seat_code: str
    floor: int
    row_num: int
    col_num: int
    seat_type: str | None = None
    status: SeatStatus  # AVAILABLE = trống, BOOKED = đã đặt, HELD = đang giữ
    hold_seconds_left: int | None = None  # chỉ có khi HELD, để FE làm đếm ngược


class SeatMapOut(BaseModel):
    trip_id: int
    bus_type_name: str
    floors: int
    rows_per_floor: int
    cols_per_floor: int
    price: float | None = None  # giá vé 1 ghế, FE dùng để tính tổng tiền
    departure_time: datetime | None = None
    total_seats: int
    available_count: int
    seats: list[SeatOut]  # đã sắp theo tầng -> hàng -> cột để FE vẽ lưới