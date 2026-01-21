from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.employee import Employee
from app.schemas.birthday import BirthdayEntry


router = APIRouter(prefix="/birthdays", tags=["birthdays"])


@router.get("/", response_model=List[BirthdayEntry])
def list_birthdays(
    db: Session = Depends(get_db),
    month: Optional[int] = Query(default=None, ge=1, le=12),
) -> List[Employee]:
    employees = db.query(Employee).filter(Employee.birthday.isnot(None)).all()
    if month is None:
        return employees
    return [employee for employee in employees if employee.birthday and employee.birthday.month == month]
