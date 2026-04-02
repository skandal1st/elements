"""Роуты /it/licenses — лицензии ПО."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from backend.modules.it.dependencies import get_db, get_current_user, require_it_roles
from backend.modules.it.models import SoftwareLicense, LicenseAssignment
from backend.modules.hr.models.employee import Employee
from backend.modules.it.schemas.license import (
    SoftwareLicenseCreate,
    SoftwareLicenseOut,
    SoftwareLicenseUpdate,
    LicenseAssignmentCreate,
    LicenseAssignmentOut,
)
from backend.modules.hr.models.user import User


router = APIRouter(prefix="/licenses", tags=["licenses"])


@router.get("/", response_model=List[SoftwareLicenseOut])
def list_licenses(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    search: Optional[str] = Query(None),
    expired: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> List[SoftwareLicenseOut]:
    """Получить список лицензий ПО (только для admin/it_specialist)"""
    role = user.get_role("it") if not user.is_superuser else "admin"
    if role not in ("admin", "it_specialist"):
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    
    q = db.query(SoftwareLicense)
    
    if search and search.strip():
        s = f"%{search.strip()}%"
        q = q.filter(
            or_(
                SoftwareLicense.software_name.ilike(s),
                SoftwareLicense.vendor.ilike(s),
            )
        )
    
    if expired is True:
        from datetime import date
        q = q.filter(SoftwareLicense.expires_at < date.today())
    elif expired is False:
        from datetime import date
        q = q.filter(
            or_(
                SoftwareLicense.expires_at.is_(None),
                SoftwareLicense.expires_at >= date.today(),
            )
        )
    
    q = q.order_by(SoftwareLicense.software_name)
    offset = (page - 1) * page_size
    licenses = q.offset(offset).limit(page_size).all()
    
    # Формируем ответ с вычисляемым полем available_licenses
    result = []
    for lic in licenses:
        lic_dict = {
            "id": lic.id,
            "software_name": lic.software_name,
            "vendor": lic.vendor,
            "license_type": lic.license_type,
            "license_key": lic.license_key,
            "total_licenses": lic.total_licenses,
            "used_licenses": lic.used_licenses,
            "expires_at": lic.expires_at,
            "cost": lic.cost,
            "purchase_date": lic.purchase_date,
            "notes": lic.notes,
            "created_at": lic.created_at,
            "updated_at": lic.updated_at,
            "available_licenses": lic.total_licenses - lic.used_licenses,
        }
        result.append(SoftwareLicenseOut(**lic_dict))
    
    return result


@router.get("/{license_id}", response_model=SoftwareLicenseOut)
def get_license(
    license_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SoftwareLicenseOut:
    """Получить лицензию по ID с привязками"""
    role = user.get_role("it") if not user.is_superuser else "admin"
    if role not in ("admin", "it_specialist"):
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")
    
    lic = db.query(SoftwareLicense).filter(SoftwareLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Лицензия не найдена")
    
    # Загружаем активные привязки
    assignments = (
        db.query(LicenseAssignment)
        .filter(
            LicenseAssignment.license_id == license_id,
            LicenseAssignment.released_at.is_(None),
        )
        .order_by(LicenseAssignment.assigned_at.desc())
        .all()
    )
    
    # Формируем ответ с привязками
    assignments_out = []
    for assignment in assignments:
        assignment_dict = {
            "id": assignment.id,
            "license_id": assignment.license_id,
            "employee_id": getattr(assignment, "employee_id", None),
            "user_id": assignment.user_id,
            "equipment_id": assignment.equipment_id,
            "assigned_at": assignment.assigned_at,
            "released_at": assignment.released_at,
        }
        
        if assignment.employee:
            assignment_dict["employee_name"] = assignment.employee.full_name
            assignment_dict["employee_email"] = assignment.employee.email
        elif assignment.user:
            assignment_dict["user_name"] = assignment.user.full_name
            assignment_dict["user_email"] = assignment.user.email
        
        if assignment.equipment:
            assignment_dict["equipment_name"] = assignment.equipment.name
            assignment_dict["equipment_inventory"] = assignment.equipment.inventory_number
        
        assignments_out.append(LicenseAssignmentOut(**assignment_dict))
    
    lic_dict = {
        "id": lic.id,
        "software_name": lic.software_name,
        "vendor": lic.vendor,
        "license_type": lic.license_type,
        "license_key": lic.license_key,
        "total_licenses": lic.total_licenses,
        "used_licenses": lic.used_licenses,
        "expires_at": lic.expires_at,
        "cost": lic.cost,
        "purchase_date": lic.purchase_date,
        "notes": lic.notes,
        "created_at": lic.created_at,
        "updated_at": lic.updated_at,
        "available_licenses": lic.total_licenses - lic.used_licenses,
        "assignments": assignments_out,
    }
    
    return SoftwareLicenseOut(**lic_dict)


@router.post("/", response_model=SoftwareLicenseOut, status_code=201, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def create_license(
    payload: SoftwareLicenseCreate,
    db: Session = Depends(get_db),
) -> SoftwareLicenseOut:
    """Создать лицензию ПО"""
    data = payload.model_dump()
    lic = SoftwareLicense(**data)
    db.add(lic)
    db.commit()
    db.refresh(lic)
    
    lic_dict = {
        "id": lic.id,
        "software_name": lic.software_name,
        "vendor": lic.vendor,
        "license_type": lic.license_type,
        "license_key": lic.license_key,
        "total_licenses": lic.total_licenses,
        "used_licenses": lic.used_licenses,
        "expires_at": lic.expires_at,
        "cost": lic.cost,
        "purchase_date": lic.purchase_date,
        "notes": lic.notes,
        "created_at": lic.created_at,
        "updated_at": lic.updated_at,
        "available_licenses": lic.total_licenses - lic.used_licenses,
    }
    
    return SoftwareLicenseOut(**lic_dict)


@router.patch("/{license_id}", response_model=SoftwareLicenseOut, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def update_license(
    license_id: UUID,
    payload: SoftwareLicenseUpdate,
    db: Session = Depends(get_db),
) -> SoftwareLicenseOut:
    """Обновить лицензию ПО"""
    lic = db.query(SoftwareLicense).filter(SoftwareLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Лицензия не найдена")
    
    update_data = payload.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(lic, k, v)
    
    db.commit()
    db.refresh(lic)
    
    lic_dict = {
        "id": lic.id,
        "software_name": lic.software_name,
        "vendor": lic.vendor,
        "license_type": lic.license_type,
        "license_key": lic.license_key,
        "total_licenses": lic.total_licenses,
        "used_licenses": lic.used_licenses,
        "expires_at": lic.expires_at,
        "cost": lic.cost,
        "purchase_date": lic.purchase_date,
        "notes": lic.notes,
        "created_at": lic.created_at,
        "updated_at": lic.updated_at,
        "available_licenses": lic.total_licenses - lic.used_licenses,
    }
    
    return SoftwareLicenseOut(**lic_dict)


@router.delete("/{license_id}", status_code=200, dependencies=[Depends(require_it_roles(["admin"]))])
def delete_license(
    license_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить лицензию ПО (только admin)"""
    lic = db.query(SoftwareLicense).filter(SoftwareLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Лицензия не найдена")
    
    db.delete(lic)
    db.commit()
    return {"message": "Лицензия удалена"}


@router.post("/{license_id}/assign", response_model=LicenseAssignmentOut, status_code=201, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def assign_license(
    license_id: UUID,
    payload: LicenseAssignmentCreate,
    db: Session = Depends(get_db),
) -> LicenseAssignmentOut:
    """Назначить лицензию сотруднику, оборудованию или как SaaS"""
    # Для SaaS не требуется employee_id или equipment_id
    if not payload.is_saas and not payload.employee_id and not payload.equipment_id:
        raise HTTPException(status_code=400, detail="Укажите сотрудника, оборудование или отметьте как SaaS")
    
    # Проверяем лицензию
    lic = db.query(SoftwareLicense).filter(SoftwareLicense.id == license_id).first()
    if not lic:
        raise HTTPException(status_code=404, detail="Лицензия не найдена")
    
    # Проверяем доступность
    if lic.used_licenses >= lic.total_licenses:
        raise HTTPException(status_code=400, detail="Нет доступных лицензий")
    
    # Создаем привязку
    # Для SaaS - employee_id и equipment_id будут None
    assignment = LicenseAssignment(
        license_id=license_id,
        employee_id=payload.employee_id if not payload.is_saas else None,
        equipment_id=payload.equipment_id if not payload.is_saas else None,
    )
    db.add(assignment)
    
    # Увеличиваем счетчик использованных лицензий
    lic.used_licenses += 1
    
    db.commit()
    db.refresh(assignment)
    db.refresh(lic)
    
    # Формируем ответ
    assignment_dict = {
        "id": assignment.id,
        "license_id": assignment.license_id,
        "employee_id": assignment.employee_id,
        "user_id": assignment.user_id,
        "equipment_id": assignment.equipment_id,
        "assigned_at": assignment.assigned_at,
        "released_at": assignment.released_at,
    }
    
    if assignment.employee:
        assignment_dict["employee_name"] = assignment.employee.full_name
        assignment_dict["employee_email"] = assignment.employee.email
    elif assignment.user:
        assignment_dict["user_name"] = assignment.user.full_name
        assignment_dict["user_email"] = assignment.user.email
    
    if assignment.equipment:
        assignment_dict["equipment_name"] = assignment.equipment.name
        assignment_dict["equipment_inventory"] = assignment.equipment.inventory_number
    
    return LicenseAssignmentOut(**assignment_dict)


@router.post("/{license_id}/release/{assignment_id}", status_code=200, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def release_license(
    license_id: UUID,
    assignment_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Освободить лицензию"""
    from datetime import datetime, timezone
    
    # Проверяем привязку
    assignment = db.query(LicenseAssignment).filter(
        LicenseAssignment.id == assignment_id,
        LicenseAssignment.license_id == license_id,
        LicenseAssignment.released_at.is_(None),
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Привязка не найдена или уже освобождена")
    
    # Освобождаем лицензию
    assignment.released_at = datetime.now(timezone.utc)
    
    # Уменьшаем счетчик использованных лицензий
    lic = db.query(SoftwareLicense).filter(SoftwareLicense.id == license_id).first()
    if lic:
        lic.used_licenses = max(lic.used_licenses - 1, 0)
    
    db.commit()
    
    return {"message": "Лицензия освобождена"}
