"""Роуты /it/zabbix — интеграция с Zabbix."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.hr.models.user import User
from backend.modules.it.dependencies import get_current_user, get_db, require_it_roles
from backend.modules.it.models import Equipment
from backend.modules.it.services.zabbix_service import zabbix_service

router = APIRouter(prefix="/zabbix", tags=["zabbix"])


@router.get(
    "/status",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def get_zabbix_status(
    db: Session = Depends(get_db),
) -> dict:
    """Проверить статус подключения к Zabbix"""
    try:
        connected = await zabbix_service.check_connection(db)
        version = None
        if connected:
            version = await zabbix_service.get_api_version(db)

        return {
            "connected": connected,
            "version": version,
        }
    except Exception as e:
        return {
            "connected": False,
            "error": str(e),
        }


@router.get(
    "/hosts",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def get_hosts(
    db: Session = Depends(get_db),
    group_id: Optional[str] = None,
) -> List[dict]:
    """Получить список хостов из Zabbix"""
    group_ids = [group_id] if group_id else None
    return await zabbix_service.get_hosts(db, group_ids)


@router.get(
    "/groups",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def get_host_groups(
    db: Session = Depends(get_db),
) -> List[dict]:
    """Получить группы хостов"""
    return await zabbix_service.get_host_groups(db)


@router.get(
    "/templates",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def get_templates(
    db: Session = Depends(get_db),
    search: Optional[str] = None,
) -> List[dict]:
    """Получить шаблоны Zabbix"""
    return await zabbix_service.get_templates(db, search)


@router.get(
    "/equipment/{equipment_id}/status",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
async def get_equipment_zabbix_status(
    equipment_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Получить статус оборудования в Zabbix (по IP)"""
    # Получаем оборудование
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")

    if not equipment.ip_address:
        raise HTTPException(status_code=400, detail="У оборудования не указан IP-адрес")

    # Ищем хост в Zabbix по IP
    host = await zabbix_service.get_host_by_ip(db, equipment.ip_address)

    if not host:
        return {
            "found": False,
            "message": f"Хост с IP {equipment.ip_address} не найден в Zabbix",
        }

    # Получаем статус доступности
    availability = await zabbix_service.get_host_availability(db, host["hostid"])

    return {
        "found": True,
        "host": {
            "hostid": host["hostid"],
            "name": host["name"],
            "status": host["status"],
        },
        "available": availability["available"],
        "lastCheck": availability["lastCheck"],
    }


@router.get(
    "/equipment/{equipment_id}/counters",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
async def get_equipment_page_counters(
    equipment_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Получить счётчики страниц принтера из Zabbix"""
    # Получаем оборудование
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")

    if not equipment.ip_address:
        raise HTTPException(status_code=400, detail="У оборудования не указан IP-адрес")

    # Ищем хост в Zabbix по IP
    host = await zabbix_service.get_host_by_ip(db, equipment.ip_address)

    if not host:
        raise HTTPException(
            status_code=404,
            detail=f"Хост с IP {equipment.ip_address} не найден в Zabbix",
        )

    # Получаем счётчики
    counters = await zabbix_service.get_page_counters(db, host["hostid"])

    return {
        "hostid": host["hostid"],
        "hostname": host["name"],
        **counters,
    }


@router.get(
    "/equipment/{equipment_id}/supplies",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
async def get_equipment_supplies_levels(
    equipment_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Получить уровень расходных материалов из Zabbix"""
    # Получаем оборудование
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")

    if not equipment.ip_address:
        raise HTTPException(status_code=400, detail="У оборудования не указан IP-адрес")

    # Ищем хост в Zabbix по IP
    host = await zabbix_service.get_host_by_ip(db, equipment.ip_address)

    if not host:
        raise HTTPException(
            status_code=404,
            detail=f"Хост с IP {equipment.ip_address} не найден в Zabbix",
        )

    # Получаем уровни расходников
    supplies = await zabbix_service.get_supplies_levels(db, host["hostid"])

    return {
        "hostid": host["hostid"],
        "hostname": host["name"],
        **supplies,
    }


@router.post(
    "/equipment/{equipment_id}/add",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def add_equipment_to_zabbix(
    equipment_id: UUID,
    group_ids: List[str],
    template_ids: Optional[List[str]] = None,
    snmp_community: str = "public",
    db: Session = Depends(get_db),
) -> dict:
    """Добавить оборудование в Zabbix"""
    # Получаем оборудование
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")

    if not equipment.ip_address:
        raise HTTPException(status_code=400, detail="У оборудования не указан IP-адрес")

    # Проверяем, нет ли уже такого хоста
    existing = await zabbix_service.get_host_by_ip(db, equipment.ip_address)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Хост с IP {equipment.ip_address} уже существует в Zabbix",
        )

    # Создаём хост
    result = await zabbix_service.create_host(
        db,
        name=equipment.name,
        ip=equipment.ip_address,
        group_ids=group_ids,
        template_ids=template_ids,
        snmp_community=snmp_community,
        description=f"Инв. номер: {equipment.inventory_number}",
    )

    return {
        "success": True,
        "hostids": result.get("hostids", []),
    }


@router.delete(
    "/host/{host_id}",
    dependencies=[Depends(require_it_roles(["admin"]))],
)
async def delete_zabbix_host(
    host_id: str,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить хост из Zabbix"""
    result = await zabbix_service.delete_host(db, host_id)
    return {
        "success": True,
        "hostids": result.get("hostids", []),
    }
