from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class SeatTypeEnum(str, Enum):
    seat = "seat"
    berth = "berth"


class SeatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    bus_type_id: int
    floor: int
    row_num: int
    col_num: int
    seat_code: str
    seat_type: SeatTypeEnum
    is_active: bool