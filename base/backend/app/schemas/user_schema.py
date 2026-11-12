from pydantic import BaseModel, ConfigDict
from datetime import datetime

class UserResponse(BaseModel):
    id: int
    email: str
    phone: str
    full_name: str
    role: str
    status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)