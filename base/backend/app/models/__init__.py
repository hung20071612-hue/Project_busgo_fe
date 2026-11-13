# Import mọi model ở đây để Base.metadata.create_all() "nhìn thấy" và tạo bảng.
# Thêm model mới -> nhớ thêm 1 dòng import vào file này.
from app.models.user import UserModel  # noqa: F401
from app.models.booking import Booking, BookingDetail, Payment
from app.models.trip import Trip, TripStatus
from app.models.route import Route
from app.models.seat import Seat
from app.models.station import Station
from app.models.bus_type import BusType
from app.models.bus import Bus
from app.models.driver import Driver
