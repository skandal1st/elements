"""
Проверка контрагента по ИНН через API ФНС (api-fns.ru).
Ключ задаётся в Настройки → Договора / ФНС (или FNS_API_KEY в .env).
"""
import re
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.modules.contracts.dependencies import get_db, get_current_user
from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User

router = APIRouter(tags=["contracts-check-inn"])


def _normalize_inn(inn: str) -> str:
    return re.sub(r"\D", "", inn)


def _get_fns_api_key(db: Session) -> str:
    """Ключ из настроек (БД) или из .env."""
    row = db.query(SystemSettings).filter(SystemSettings.setting_key == "fns_api_key").first()
    if row and row.setting_value and row.setting_value.strip():
        return row.setting_value.strip()
    return settings.fns_api_key or ""


@router.get("/check-inn")
def check_inn(
    inn: str = Query(..., min_length=10, max_length=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Получить данные организации/ИП по ИНН из реестра ФНС (api-fns.ru).
    Возвращает: name, full_name, inn, kpp, address, status.
    """
    api_key = _get_fns_api_key(db)
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Проверка по ИНН не настроена. Укажите ключ в Настройки → Договора / ФНС (или FNS_API_KEY в .env).",
        )
    normalized = _normalize_inn(inn)
    if len(normalized) not in (10, 12):
        raise HTTPException(status_code=400, detail="ИНН должен содержать 10 или 12 цифр")

    url = "https://api-fns.ru/api/multinfo?" + urlencode({"req": normalized, "key": api_key})
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Ошибка запроса к ФНС: {e}") from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Ошибка: {e}") from e

    items = data.get("items") or []
    if not items:
        raise HTTPException(status_code=404, detail="По указанному ИНН данные не найдены")

    item = items[0]
    name = ""
    full_name = ""
    kpp = ""
    address = ""
    status = ""

    if "ЮЛ" in item:
        ul = item["ЮЛ"]
        name = (ul.get("НаимСокрЮЛ") or "").strip()
        full_name = (ul.get("НаимПолнЮЛ") or "").strip()
        kpp = (ul.get("КПП") or "").strip()
        status = (ul.get("Статус") or "").strip()
        addr = ul.get("Адрес")
        if isinstance(addr, dict):
            address = (addr.get("АдресПолн") or "").strip()
            if not address and isinstance(addr.get("АдресПолн"), dict):
                parts = addr["АдресПолн"]
                address = ", ".join(str(v) for v in (parts or {}).values() if v)
        elif isinstance(addr, str):
            address = addr.strip()
    elif "ИП" in item:
        ip = item["ИП"]
        name = full_name = (ip.get("ФИОПолн") or "").strip()
        status = (ip.get("Статус") or "").strip()
        addr = ip.get("Адрес")
        if isinstance(addr, dict):
            address = (addr.get("АдресПолн") or "").strip()
            if not address and isinstance(addr.get("АдресПолн"), dict):
                parts = addr["АдресПолн"]
                address = ", ".join(str(v) for v in (parts or {}).values() if v)
        elif isinstance(addr, str):
            address = addr.strip()

    return {
        "name": name or full_name or "—",
        "full_name": full_name or name or "—",
        "inn": normalized,
        "kpp": kpp or None,
        "address": address or None,
        "status": status or None,
    }
