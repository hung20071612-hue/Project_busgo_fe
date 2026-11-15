# Import mọi model ở đây để Base.metadata.create_all() "nhìn thấy" và tạo bảng.
# Thêm model mới -> nhớ thêm 1 dòng import vào file này.
from app.models.booking import (
    Booking,
    BookingDetail,
    BookingStatus,
    Payment,
    PaymentMethod,
    PaymentStatus,
)
from app.models.bus import Bus, BusStatusEnum
from app.models.bus_type import BusType, SeatTypeEnum
from app.models.driver import Driver, DriverStatusEnum
from app.models.route import Route
from app.models.seat import Seat
from app.models.station import Station
from app.models.trip import Trip, TripStatus
from app.models.user import UserModel, UserRole, UserStatus

__all__ = [
    "Booking",
    "BookingDetail",
    "BookingStatus",
    "Payment",
    "PaymentMethod",
    "PaymentStatus",
    "Bus",
    "BusStatusEnum",
    "BusType",
    "SeatTypeEnum",
    "Driver",
    "DriverStatusEnum",
    "Route",
    "Seat",
    "Station",
    "Trip",
    "TripStatus",
    "UserModel",
    "UserRole",
    "UserStatus",
]
