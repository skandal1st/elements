from pydantic import BaseModel


class PhonebookEntry(BaseModel):
    id: int
    full_name: str
    internal_phone: str | None = None
    external_phone: str | None = None
    email: str | None = None
    department_id: int | None = None
    position_id: int | None = None

    class Config:
        from_attributes = True
