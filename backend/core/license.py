"""
License validation client for Elements Platform.

Provides license validation with hardware fingerprinting, caching,
and mandatory production checks.
"""

import hashlib
import json
import logging
import os
import platform
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

import redis
from redis.exceptions import RedisError

from .config import settings

logger = logging.getLogger(__name__)


# Redis client initialization
redis_client: Optional[redis.Redis] = None

try:
    if settings.redis_url:
        redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        logger.info("Redis client initialized for license caching")
except Exception as e:
    logger.warning(f"Failed to connect to Redis: {e}")
    redis_client = None


class LicenseError(Exception):
    """Raised when license validation fails in production."""
    pass


def get_mac_address() -> str:
    """
    Gets the MAC address of the first available network interface.

    Returns:
        MAC address as string (e.g., "00:11:22:33:44:55")
    """
    try:
        mac = uuid.getnode()
        mac_str = ':'.join(('%012X' % mac)[i:i+2] for i in range(0, 12, 2))
        return mac_str
    except Exception as e:
        logger.warning(f"Failed to get MAC address: {e}")
        return "00:00:00:00:00:00"


def get_hardware_id() -> str:
    """
    Generates a stable hardware ID based on system characteristics.

    Uses:
    - CPU info (processor name)
    - MAC address
    - Hostname

    Returns:
        SHA256 hash of hardware characteristics
    """
    components = [
        platform.processor() or "unknown-cpu",
        get_mac_address(),
        platform.node() or "unknown-host"
    ]

    hardware_string = "-".join(components)
    hardware_id = hashlib.sha256(hardware_string.encode()).hexdigest()

    return hardware_id


def get_or_create_instance_id() -> str:
    """
    Gets or creates a persistent instance ID for Docker containers.

    In Docker environments, hardware characteristics may change on restart.
    This function creates a persistent ID stored in a volume-mounted directory.

    Returns:
        Hardware ID (existing from file or newly generated)
    """
    instance_file = Path("/app/data/.instance_id")

    # Try to read existing instance ID
    if instance_file.exists():
        try:
            with open(instance_file, 'r') as f:
                instance_id = f.read().strip()
                if instance_id:
                    logger.debug(f"Using existing instance ID from {instance_file}")
                    return instance_id
        except Exception as e:
            logger.warning(f"Failed to read instance ID file: {e}")

    # Generate new instance ID
    instance_id = get_hardware_id()

    # Try to save it
    try:
        instance_file.parent.mkdir(parents=True, exist_ok=True)
        with open(instance_file, 'w') as f:
            f.write(instance_id)
        logger.info(f"Created new instance ID: {instance_id[:16]}...")
    except Exception as e:
        logger.warning(f"Failed to save instance ID: {e}")

    return instance_id


class LicenseClient:
    """
    Client for validating licenses against License Server.

    Features:
    - Hardware fingerprinting for instance binding
    - Redis caching (TTL: 5 minutes)
    - Mandatory validation in production
    - Grace period handling for server unavailability
    """

    def __init__(self):
        self.license_server_url = settings.license_server_url
        self.company_id = settings.company_id
        self.cache_ttl = 300  # 5 minutes
        self.timeout = 10.0  # seconds
        self.is_production = os.getenv("ENVIRONMENT", "development") == "production"

    def _get_cache_key(self, key_type: str) -> str:
        """Generates cache key for license data."""
        return f"license:{self.company_id}:{key_type}"

    def _get_from_cache(self, key: str) -> Optional[Dict[str, Any]]:
        """Gets value from Redis cache."""
        if not redis_client:
            return None

        try:
            cached = redis_client.get(key)
            if cached:
                return json.loads(cached)
        except RedisError as e:
            logger.warning(f"Redis read error: {e}")
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to decode cached license data: {e}")

        return None

    def _set_to_cache(self, key: str, value: Dict[str, Any]):
        """Saves value to Redis cache with TTL."""
        if not redis_client:
            return

        try:
            redis_client.setex(key, self.cache_ttl, json.dumps(value))
        except RedisError as e:
            logger.warning(f"Redis write error: {e}")

    async def validate_license(self, *_args, **_kwargs) -> Dict[str, Any]:
        """
        Проверяет активную офлайн-лицензию из БД (platform_licenses).

        В production-режиме отсутствие/невалидность лицензии — фатально (LicenseError).
        В dev-режиме при отсутствии лицензии возвращаем permissive fallback.
        Поддерживается grace-период GRACE_PERIOD_DAYS (см. backend.core.platform_license).

        Возвращает словарь с полями:
            valid, edition, expires_at, modules, max_users, features
        """
        # Кэш Redis (TTL 5 мин)
        cache_key = self._get_cache_key("validation")
        cached = self._get_from_cache(cache_key)
        if cached:
            logger.debug("Using cached license validation")
            return cached

        # Локальные импорты, чтобы избежать циклов
        from backend.core.database import SessionLocal
        from backend.core.platform_license import (
            LicenseValidationError,
            get_license_status,
        )

        db = SessionLocal()
        try:
            try:
                status = get_license_status(db)
            except LicenseValidationError as exc:
                logger.error(f"License validation failed: {exc}")
                if self.is_production:
                    raise LicenseError(str(exc))
                return self._dev_fallback()
        finally:
            db.close()

        if not status["valid"]:
            state = status.get("state")
            if state == "absent":
                if self.is_production:
                    raise LicenseError("Лицензия не установлена")
                return self._dev_fallback()
            error_msg = (
                "Срок действия лицензии истёк" if state == "expired"
                else "Лицензия недействительна"
            )
            if self.is_production:
                raise LicenseError(error_msg)
            return self._dev_fallback()

        lic = status["license"] or {}
        data = {
            "valid": True,
            "edition": lic.get("edition", ""),
            "expires_at": lic.get("expires_at"),
            "modules": list(lic.get("modules") or []),
            "max_users": lic.get("max_users"),
            "features": dict(lic.get("features") or {}),
            "state": status.get("state"),
            "days_until_expiry": status.get("days_until_expiry"),
        }
        self._set_to_cache(cache_key, data)
        logger.info(f"License validated from DB, expires: {data['expires_at']} (state={data['state']})")
        return data

    def _dev_fallback(self) -> Dict[str, Any]:
        """Returns permissive license data for development."""
        return {
            "valid": True,
            "edition": os.getenv("EDITION", "core"),
            "expires_at": "2099-12-31T23:59:59Z",
            "modules": ["portal", "hr", "it", "tasks", "knowledge_core"],
            "max_users": None,
            "features": {}
        }

    async def check_module_access(self, module: str) -> bool:
        """
        Checks if a module is accessible according to license.

        Args:
            module: Module name (e.g., "hr", "it", "tasks")

        Returns:
            True if module is accessible, False otherwise
        """
        try:
            license_data = await self.validate_license()
            allowed_modules = license_data.get("modules", [])
            return module in allowed_modules
        except LicenseError as e:
            logger.error(f"Module access check failed: {e}")
            return False

    async def check_feature_access(self, feature: str) -> bool:
        """
        Checks if a feature is accessible according to license.

        Args:
            feature: Feature name (e.g., "rocketchat", "zabbix")

        Returns:
            True if feature is accessible, False otherwise
        """
        try:
            license_data = await self.validate_license()
            features = license_data.get("features", {})
            return features.get(feature, False)
        except LicenseError as e:
            logger.error(f"Feature access check failed: {e}")
            return False

    async def get_available_modules(self, *_args, **_kwargs) -> List[str]:
        """
        Список модулей, доступных по активной лицензии.

        Дополнительные аргументы игнорируются (обратная совместимость с вызовами,
        передающими company_id).
        """
        try:
            license_data = await self.validate_license()
            return license_data.get("modules", [])
        except LicenseError as e:
            logger.error(f"Failed to get available modules: {e}")
            return []


# Global license client instance
license_client = LicenseClient()
