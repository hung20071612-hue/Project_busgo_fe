from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import OperationalError

from app import models
from app.core.config import settings
from app.core.exceptions import global_exception_handler
from app.db.session import Base, engine
from app.routers import (
    admin_users,
    auth_router,
    bookings,
    bus_types,
    buses,
    cancel_booking,
    check_bookings,
    driver,
    health,
    payments,
    routes,
    seat_hold,
    stations,
    statistics,
    trip_seats,
    trips,
    user,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        print(f"[DB] Đã kết nối MySQL {settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}")
    except OperationalError as error:
        print("[DB] KHÔNG kết nối được MySQL! Kiểm tra MySQL đã bật chưa và file .env.")
        if "Unknown database" in str(error.orig):
            print("[DB] Chưa có database -> mở MySQL Workbench, chạy file sql/init.sql")
        print(f"[DB] Chi tiết: {error.orig}")
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.state.limiter = auth_router.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_exception_handler(Exception, global_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(auth_router.router, prefix="/api")
app.include_router(user.router, prefix="/api")
app.include_router(trip_seats.router, prefix="/api")
app.include_router(seat_hold.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(cancel_booking.router, prefix="/api")
app.include_router(check_bookings.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(trips.router, prefix="/api")
app.include_router(stations.router, prefix="/api/admin")
app.include_router(routes.router, prefix="/api/admin")
app.include_router(buses.router, prefix="/api/admin")
app.include_router(bus_types.router, prefix="/api/admin")
app.include_router(driver.router, prefix="/api/admin")
app.include_router(admin_users.router, prefix="/api/admin")
app.include_router(statistics.router, prefix="/api/admin")


@app.get("/")
def root():
    return {"message": f"{settings.APP_NAME} đang chạy. Xem tài liệu API tại /docs"}