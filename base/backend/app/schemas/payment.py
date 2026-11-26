"""Schema cho API thanh toán giả lập.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PaymentIn(BaseModel):
    # TẠM: chưa có đăng nhập nên FE gửi user_id. Khi có JWT thì lấy từ token.
    user_id: int = Field(examples=["10001"])
    booking_id: int = Field(examples=[1])
    method: Literal["CASH", "TRANSFER", "WALLET"] = Field(
        description="CASH = tiền mặt, TRANSFER = chuyển khoản, WALLET = ví", examples=["CASH"]
    )


class PaymentOut(BaseModel):
    payment_id: int
    booking_id: int
    booking_code: str
    booking_status: str  # PAID sau khi thanh toán thành công
    method: str
    amount: float
    status: str  # SUCCESS
    paid_at: datetime