"""Сервис для работы с оборудованием IT-модуля."""

from sqlalchemy.orm import Session

from backend.modules.it.models import Equipment


def get_equipment_by_owner(
    db: Session,
    employee_id: int | None = None,
    email: str | None = None,
) -> list[dict]:
    """Получить оборудование сотрудника по ID или email.

    Args:
        db: SQLAlchemy сессия
        employee_id: ID сотрудника в таблице employees
        email: Email сотрудника (для поиска по связи)

    Returns:
        Список оборудования в виде словарей
    """
    if not employee_id and not email:
        return []

    query = db.query(Equipment).filter(Equipment.status == "in_use")

    if employee_id:
        query = query.filter(Equipment.current_owner_id == employee_id)
    elif email:
        # Поиск сотрудника по email для получения его оборудования
        from backend.modules.hr.models.employee import Employee

        employee = db.query(Employee).filter(Employee.email == email).first()
        if not employee:
            return []
        query = query.filter(Equipment.current_owner_id == employee.id)

    return [
        {
            "id": str(eq.id),
            "name": eq.name,
            "type": eq.category,
            "model": eq.model,
            "inventory_number": eq.inventory_number,
            "serial_number": eq.serial_number,
        }
        for eq in query.all()
    ]
