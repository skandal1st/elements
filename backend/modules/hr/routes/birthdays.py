"""Роуты /hr/birthdays."""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.modules.hr.dependencies import get_db
from backend.modules.hr.models.employee import Employee
from backend.modules.hr.schemas.birthday import BirthdayEntry

router = APIRouter(prefix="/birthdays", tags=["birthdays"])


@router.get("/", response_model=List[BirthdayEntry])
def list_birthdays(
    db: Session = Depends(get_db),
    month: Optional[int] = Query(default=None, ge=1, le=12),
) -> List[Employee]:
    employees = db.query(Employee).filter(Employee.birthday.isnot(None)).all()
    if month is None:
        return employees
    return [e for e in employees if e.birthday and e.birthday.month == month]
