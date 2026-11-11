# Import mọi model ở đây để Base.metadata.create_all() "nhìn thấy" và tạo bảng.
# Thêm model mới -> nhớ thêm 1 dòng import vào file này.
from app.models.item import Item  # noqa: F401
from app.models.booking import Booking, BookingStatus  # noqa: F401
from app.models.bus import Bus  # noqa: F401
from app.models.driver import Driver  # noqa: F401
from app.models.route import Route  # noqa: F401
from app.models.trip import Trip, TripStatus  # noqa: F401
