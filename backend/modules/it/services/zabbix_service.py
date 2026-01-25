"""
Zabbix API Service
Интеграция с Zabbix 7.x через JSON-RPC API
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

from backend.core.config import settings


@dataclass
class ZabbixHost:
    hostid: str
    host: str
    name: str
    status: str
    interfaces: Optional[List[Dict[str, Any]]] = None


@dataclass
class ZabbixItem:
    itemid: str
    name: str
    key_: str
    lastvalue: str
    lastclock: str
    units: str


@dataclass
class ZabbixGroup:
    groupid: str
    name: str


@dataclass
class ZabbixTemplate:
    templateid: str
    name: str
    host: str


class ZabbixService:
    """Сервис для работы с Zabbix API"""

    def __init__(self):
        self._request_id = 1

    def _get_config(self, db) -> tuple[str, str]:
        """Получить настройки Zabbix из БД"""
        from backend.modules.hr.models.system_settings import SystemSettings

        url_setting = (
            db.query(SystemSettings)
            .filter(SystemSettings.setting_key == "zabbix_url")
            .first()
        )
        token_setting = (
            db.query(SystemSettings)
            .filter(SystemSettings.setting_key == "zabbix_api_token")
            .first()
        )

        url = url_setting.setting_value if url_setting else ""
        token = token_setting.setting_value if token_setting else ""

        return url, token

    def _is_enabled(self, db) -> bool:
        """Проверить включена ли интеграция"""
        from backend.modules.hr.models.system_settings import SystemSettings

        enabled_setting = (
            db.query(SystemSettings)
            .filter(SystemSettings.setting_key == "zabbix_enabled")
            .first()
        )

        return enabled_setting and enabled_setting.setting_value.lower() == "true"

    async def _request(self, db, method: str, params: Dict[str, Any] = None) -> Any:
        """Выполнить запрос к Zabbix API"""
        url, token = self._get_config(db)

        if not url or not token:
            raise ValueError(
                "Zabbix не настроен. Проверьте zabbix_url и zabbix_api_token в настройках"
            )

        body = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
            "id": self._request_id,
        }
        self._request_id += 1

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}",
                },
                timeout=30.0,
            )

        if response.status_code != 200:
            raise Exception(f"Zabbix API error: {response.status_code} {response.text}")

        data = response.json()

        if "error" in data:
            error = data["error"]
            raise Exception(
                f"Zabbix API error: {error.get('message', '')} - {error.get('data', '')}"
            )

        return data.get("result")

    async def check_connection(self, db) -> bool:
        """Проверить подключение к Zabbix"""
        try:
            await self._request(db, "apiinfo.version")
            return True
        except Exception:
            return False

    async def get_api_version(self, db) -> str:
        """Получить версию Zabbix API"""
        return await self._request(db, "apiinfo.version")

    async def get_hosts(
        self, db, group_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Получить список всех хостов"""
        params = {
            "output": ["hostid", "host", "name", "status"],
            "selectInterfaces": ["interfaceid", "ip", "type", "main", "available"],
        }

        if group_ids:
            params["groupids"] = group_ids

        return await self._request(db, "host.get", params)

    async def get_host_by_ip(self, db, ip: str) -> Optional[Dict[str, Any]]:
        """Найти хост по IP адресу"""
        hosts = await self._request(
            db,
            "host.get",
            {
                "output": ["hostid", "host", "name", "status"],
                "selectInterfaces": ["interfaceid", "ip", "type", "main", "available"],
                "filter": {},
                "searchByAny": True,
            },
        )

        # Фильтруем по IP в интерфейсах
        for host in hosts:
            interfaces = host.get("interfaces", [])
            for iface in interfaces:
                if iface.get("ip") == ip:
                    return host

        return None

    async def get_host_items(
        self, db, host_id: str, search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Получить метрики (items) хоста"""
        params = {
            "hostids": host_id,
            "output": ["itemid", "name", "key_", "lastvalue", "lastclock", "units"],
        }

        if search:
            params["search"] = {"key_": search}
            params["searchWildcardsEnabled"] = True

        return await self._request(db, "item.get", params)

    async def get_page_counters(self, db, host_id: str) -> Dict[str, Any]:
        """Получить счётчики страниц принтера"""
        items = await self.get_host_items(db, host_id)

        # Ключевые слова для счётчиков страниц
        page_counter_keys = [
            "hrprinterlifecount",
            "prtmarkerlifecount",
            "prtmiblifecount",
            "printer.pages",
            "pages.total",
            "pages.black",
            "pages.color",
        ]

        counter_items = []
        for item in items:
            key_lower = item.get("key_", "").lower()
            name_lower = item.get("name", "").lower()

            if (
                any(k in key_lower for k in page_counter_keys)
                or "page" in name_lower
                or "count" in name_lower
                or "страниц" in name_lower
            ):
                counter_items.append(item)

        total = None
        black = None
        color = None

        for item in counter_items:
            try:
                value = int(item.get("lastvalue", "0"))
            except (ValueError, TypeError):
                continue

            key_lower = item.get("key_", "").lower()
            name_lower = item.get("name", "").lower()

            if "black" in key_lower or "black" in name_lower or "чёрн" in name_lower:
                black = value
            elif "color" in key_lower or "color" in name_lower or "цвет" in name_lower:
                color = value
            elif (
                "life" in key_lower
                or "total" in key_lower
                or "total" in name_lower
                or "всего" in name_lower
            ):
                total = value
            elif total is None:
                total = value

        return {
            "total": total,
            "black": black,
            "color": color,
            "items": counter_items,
        }

    async def get_supplies_levels(self, db, host_id: str) -> Dict[str, Any]:
        """Получить уровень расходных материалов (чернила/тонер)"""
        items = await self.get_host_items(db, host_id)

        # Ключевые слова для поиска расходников
        supplies_keywords = [
            "marker",
            "supply",
            "supplies",
            "toner",
            "ink",
            "drum",
            "cartridge",
            "level",
            "capacity",
            "remaining",
            "чернил",
            "тонер",
            "картридж",
            "уровень",
        ]

        supplies_items = []
        for item in items:
            key_lower = item.get("key_", "").lower()
            name_lower = item.get("name", "").lower()

            if any(kw in key_lower or kw in name_lower for kw in supplies_keywords):
                supplies_items.append(item)

        def get_color(name: str) -> Optional[str]:
            name_lower = name.lower()
            if "black" in name_lower or "чёрн" in name_lower or "черн" in name_lower:
                return "black"
            if "cyan" in name_lower or "голуб" in name_lower:
                return "cyan"
            if "magenta" in name_lower or "пурпур" in name_lower:
                return "magenta"
            if "yellow" in name_lower or "жёлт" in name_lower or "желт" in name_lower:
                return "yellow"
            return None

        supplies = []
        for item in supplies_items:
            try:
                value = int(item.get("lastvalue", "0"))
            except (ValueError, TypeError):
                continue

            key_lower = item.get("key_", "").lower()
            name_lower = item.get("name", "").lower()

            # Пропускаем max capacity items
            if "max" in key_lower or "max" in name_lower:
                continue

            # Определяем процент или абсолютное значение
            units = item.get("units", "")
            is_percent = (
                units == "%"
                or "percent" in key_lower
                or "percent" in name_lower
                or (0 <= value <= 100 and "count" not in key_lower)
            )

            color = get_color(item.get("name", ""))

            # Ищем существующий расходник с таким цветом
            existing = None
            for s in supplies:
                if s.get("color") == color and color is not None:
                    existing = s
                    break

            if existing:
                if is_percent:
                    existing["percent"] = value
                else:
                    existing["level"] = value
            else:
                supplies.append(
                    {
                        "name": item.get("name", ""),
                        "level": None if is_percent else value,
                        "maxLevel": None,
                        "percent": value if is_percent else None,
                        "color": color,
                    }
                )

        return {
            "supplies": supplies,
            "items": supplies_items,
        }

    async def get_host_availability(self, db, host_id: str) -> Dict[str, Any]:
        """Получить статус доступности хоста"""
        try:
            hosts = await self._request(
                db,
                "host.get",
                {
                    "hostids": host_id,
                    "output": ["hostid", "host", "name", "status"],
                    "selectInterfaces": [
                        "interfaceid",
                        "ip",
                        "type",
                        "main",
                        "available",
                        "error",
                    ],
                },
            )

            if not hosts:
                return {"available": False, "lastCheck": None}

            host = hosts[0]

            # Проверяем статус хоста (status: 0 = enabled, 1 = disabled)
            if host.get("status") == "1":
                from datetime import datetime

                return {"available": False, "lastCheck": datetime.now().isoformat()}

            # Ищем главный интерфейс
            interfaces = host.get("interfaces", [])
            main_interface = None
            for iface in interfaces:
                if iface.get("main") == "1":
                    main_interface = iface
                    break

            from datetime import datetime

            now = datetime.now().isoformat()

            if main_interface:
                # available: 0 = unknown, 1 = available, 2 = unavailable
                try:
                    available_value = int(main_interface.get("available", "0"))
                except (ValueError, TypeError):
                    available_value = 0

                return {
                    "available": available_value == 1,
                    "lastCheck": now,
                }

            # Проверяем все интерфейсы
            any_available = False
            for iface in interfaces:
                try:
                    av = int(iface.get("available", "0"))
                    if av == 1:
                        any_available = True
                        break
                except (ValueError, TypeError):
                    continue

            return {
                "available": any_available,
                "lastCheck": now,
            }

        except Exception as e:
            print(f"Error checking host availability: {e}")
            return {"available": False, "lastCheck": None}

    async def get_host_groups(self, db) -> List[Dict[str, Any]]:
        """Получить группы хостов"""
        return await self._request(
            db,
            "hostgroup.get",
            {
                "output": ["groupid", "name"],
                "sortfield": "name",
            },
        )

    async def get_templates(
        self, db, search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Получить шаблоны"""
        params = {
            "output": ["templateid", "name", "host"],
            "sortfield": "name",
        }

        if search:
            params["search"] = {"name": search}
            params["searchWildcardsEnabled"] = True

        return await self._request(db, "template.get", params)

    async def create_host(
        self,
        db,
        name: str,
        ip: str,
        group_ids: List[str],
        template_ids: Optional[List[str]] = None,
        snmp_community: str = "public",
        description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Создать хост в Zabbix"""
        import re

        # Создаём техническое имя хоста
        host_technical_name = re.sub(r"[^a-zA-Z0-9\-_]", "_", name)[:64]

        params = {
            "host": host_technical_name,
            "name": name,
            "groups": [{"groupid": gid} for gid in group_ids],
            "interfaces": [
                {
                    "type": 2,  # SNMP
                    "main": 1,
                    "useip": 1,
                    "ip": ip,
                    "dns": "",
                    "port": "161",
                    "details": {
                        "version": 2,  # SNMP v2c
                        "community": snmp_community,
                    },
                },
            ],
        }

        if template_ids:
            params["templates"] = [{"templateid": tid} for tid in template_ids]

        if description:
            params["description"] = description

        return await self._request(db, "host.create", params)

    async def delete_host(self, db, host_id: str) -> Dict[str, Any]:
        """Удалить хост из Zabbix"""
        return await self._request(db, "host.delete", [host_id])


# Singleton instance
zabbix_service = ZabbixService()
