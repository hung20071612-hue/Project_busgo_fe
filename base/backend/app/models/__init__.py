# Import mọi model ở đây để Base.metadata.create_all() "nhìn thấy" và tạo bảng.
# Thêm model mới -> nhớ thêm 1 dòng import vào file này.
from app.models.user import UserModel  # noqa: F401
from app.models.item import Item
from app.models.booking import Booking, BookingDetail, Payment
from app.models import temp_stubs
from app.models.item import Item  # noqa: F401
from app.models.user import User
from app.models.trip import Trip
from app.models.booking import Booking
from app.models.booking_detail import BookingDetail
from app.models.payment import Payment
from app.models.route import Route
from app.models.seat import Seat
from app.models.station import Station
from app.models.bus_type import BusType
