from datetime import date

from pydantic import BaseModel


class BirthdayEntry(BaseModel):
    id: int
    full_name: str
    department_id: int | None = None
    birthday: date | None = None

    class Config:
        from_attributes = True
