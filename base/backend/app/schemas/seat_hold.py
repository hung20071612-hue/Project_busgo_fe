"""Schema cho API giữ ghế tạm """
from datetime import datetime

from pydantic import BaseModel, Field


class SeatHoldIn(BaseModel):
    # TẠM: chưa có đăng nhập nên FE gửi user_id lên. Khi có JWT thì bỏ trường này
    # và lấy user từ token (Depends get_current_user).
    user_id: int = Field(examples=["0001"])
    seat_ids: list[int] = Field(min_length=1, max_length=5, examples=[[1, 2]])
    # Gửi booking_id của lần giữ trước để THÊM ghế vào cùng phiên (chung 1 đồng hồ đếm ngược)
    booking_id: int | None = Field(default=None, examples=[None])


class SeatHoldOut(BaseModel):
    booking_id: int
    booking_code: str
    trip_id: int
    seat_ids: list[int]  # toàn bộ ghế đang giữ trong phiên này
    hold_until: datetime | None  # None khi không còn ghế nào
    hold_seconds_left: int | None  # số giây còn lại
    total_price: float