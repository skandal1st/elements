from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.employee import Employee
from app.schemas.phonebook import PhonebookEntry


router = APIRouter(prefix="/phonebook", tags=["phonebook"])


@router.get("/", response_model=List[PhonebookEntry])
def phonebook(
    db: Session = Depends(get_db),
    q: Optional[str] = Query(default=None),
    department_id: Optional[int] = Query(default=None),
) -> List[Employee]:
    query = db.query(Employee)
    if q:
        query = query.filter(Employee.full_name.ilike(f"%{q}%"))
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    return query.all()
