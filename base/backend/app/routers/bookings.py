from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import booking as booking_crud
from app.db.session import get_db
from app.schemas.booking import BookingCreateIn, BookingOut

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def create_booking(data: BookingCreateIn, db: Session = Depends(get_db)):
    try:
        return booking_crud.create_booking(
            db,
            user_id=data.user_id,
            booking_id=data.booking_id,
            pickup=data.pickup,
            dropoff=data.dropoff,
            passengers=[p.model_dump() for p in data.passengers],
        )
    except booking_crud.BookingError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message)