from sqlalchemy.orm import Session
from app.models.user import UserModel

def handle_get_me(user_id: int, db: Session):
    return db.query(UserModel).filter(UserModel.id == user_id).first()