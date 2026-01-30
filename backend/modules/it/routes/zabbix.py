"""Роуты /it/zabbix — интеграция с Zabbix."""

from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from backend.modules.it.dependencies import get_db, require_it_roles
from backend.modules.it.models import Equipment, EquipmentModel
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


async def _get_zabbix_host_for_equipment(db, equipment) -> Optional[dict]:
    """Найти хост в Zabbix по zabbix_host_id или по IP."""
    if equipment.zabbix_host_id:
        return await zabbix_service.get_host_by_id(db, equipment.zabbix_host_id)
    if equipment.ip_address:
        return await zabbix_service.get_host_by_ip(db, equipment.ip_address)
    return None


@router.get(
    "/equipment/{equipment_id}/status",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist", "employee"]))],
)
async def get_equipment_zabbix_status(
    equipment_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Получить статус оборудования в Zabbix (по zabbix_host_id или по IP)"""
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")

    if not equipment.ip_address and not equipment.zabbix_host_id:
        raise HTTPException(status_code=400, detail="У оборудования не указан IP-адрес и он не добавлен в Zabbix")

    host = await _get_zabbix_host_for_equipment(db, equipment)

    if not host:
        msg = (
            f"Хост с IP {equipment.ip_address} не найден в Zabbix"
            if equipment.ip_address
            else "Оборудование не добавлено в Zabbix"
        )
        return {"found": False, "message": msg}

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
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")

    if not equipment.ip_address and not equipment.zabbix_host_id:
        raise HTTPException(
            status_code=400,
            detail="У оборудования не указан IP-адрес и он не добавлен в Zabbix",
        )

    host = await _get_zabbix_host_for_equipment(db, equipment)
    if not host:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Хост с IP {equipment.ip_address} не найден в Zabbix"
                if equipment.ip_address
                else "Хост не найден в Zabbix"
            ),
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
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")

    if not equipment.ip_address and not equipment.zabbix_host_id:
        raise HTTPException(
            status_code=400,
            detail="У оборудования не указан IP-адрес и он не добавлен в Zabbix",
        )

    host = await _get_zabbix_host_for_equipment(db, equipment)
    if not host:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Хост с IP {equipment.ip_address} не найден в Zabbix"
                if equipment.ip_address
                else "Хост не найден в Zabbix"
            ),
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
    interface_type: str = "snmp",
    db: Session = Depends(get_db),
) -> dict:
    """Добавить оборудование в Zabbix"""
    equipment = (
        db.query(Equipment)
        .options(
            joinedload(Equipment.model_ref).joinedload(EquipmentModel.equipment_type),
        )
        .filter(Equipment.id == equipment_id)
        .first()
    )
    if not equipment:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")

    if not equipment.ip_address:
        raise HTTPException(status_code=400, detail="У оборудования не указан IP-адрес")

    if interface_type not in ("agent", "snmp"):
        raise HTTPException(
            status_code=400,
            detail="interface_type должен быть 'agent' или 'snmp'",
        )

    # Разрешаем шаблон из каталога, если не передан
    effective_template_ids = template_ids
    if not effective_template_ids:
        effective_template_ids = zabbix_service.resolve_template_ids_for_equipment(
            equipment
        )

    # Проверяем, нет ли уже такого хоста (по IP или по zabbix_host_id)
    if equipment.zabbix_host_id:
        existing = await zabbix_service.get_host_by_id(db, equipment.zabbix_host_id)
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Оборудование уже добавлено в Zabbix",
            )
    existing = await zabbix_service.get_host_by_ip(db, equipment.ip_address)
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Хост с IP {equipment.ip_address} уже существует в Zabbix",
        )

    result = await zabbix_service.create_host(
        db,
        name=equipment.name,
        ip=equipment.ip_address,
        group_ids=group_ids,
        template_ids=effective_template_ids,
        snmp_community=snmp_community,
        description=f"Инв. номер: {equipment.inventory_number}",
        interface_type=interface_type,
    )

    hostids = result.get("hostids", [])
    if hostids:
        equipment.zabbix_host_id = hostids[0]
        db.commit()

    return {
        "success": True,
        "hostids": hostids,
        "hostid": hostids[0] if hostids else None,
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
    # Очищаем привязку у оборудования
    db.query(Equipment).filter(Equipment.zabbix_host_id == host_id).update(
        {"zabbix_host_id": None}
    )
    db.commit()
    return {
        "success": True,
        "hostids": result.get("hostids", []),
    }


@router.delete(
    "/equipment/{equipment_id}/zabbix",
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
async def remove_equipment_from_zabbix(
    equipment_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить оборудование из Zabbix и очистить привязку"""
    equipment = db.query(Equipment).filter(Equipment.id == equipment_id).first()
    if not equipment:
        raise HTTPException(status_code=404, detail="Оборудование не найдено")

    if not equipment.zabbix_host_id:
        return {
            "success": True,
            "message": "Оборудование не было добавлено в Zabbix",
        }

    host_id = equipment.zabbix_host_id
    try:
        await zabbix_service.delete_host(db, host_id)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка при удалении хоста в Zabbix: {e}",
        )

    equipment.zabbix_host_id = None
    db.commit()
    return {
        "success": True,
        "hostids": [host_id],
    }
