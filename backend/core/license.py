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

import httpx
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

    async def validate_license(self) -> Dict[str, Any]:
        """
        Validates license with License Server.

        In production mode, this is mandatory and will raise LicenseError if:
        - License server is not configured
        - Company ID is not configured
        - License validation fails
        - License is expired

        In development mode, falls back to permissive mode on errors.

        Returns:
            License data dict with keys:
            - valid: bool
            - edition: str
            - expires_at: str (ISO format)
            - modules: List[str]
            - max_users: int or None
            - features: dict

        Raises:
            LicenseError: In production if validation fails
        """
        # Check configuration
        if not self.license_server_url:
            if self.is_production:
                raise LicenseError("LICENSE_SERVER_URL not configured")
            logger.warning("LICENSE_SERVER_URL not configured, using development mode")
            return self._dev_fallback()

        if not self.company_id:
            if self.is_production:
                raise LicenseError("COMPANY_ID not configured")
            logger.warning("COMPANY_ID not configured, using development mode")
            return self._dev_fallback()

        # Check cache
        cache_key = self._get_cache_key("validation")
        cached = self._get_from_cache(cache_key)
        if cached:
            logger.debug("Using cached license validation")
            return cached

        # Get hardware ID
        try:
            hardware_id = get_or_create_instance_id()
        except Exception as e:
            logger.error(f"Failed to get hardware ID: {e}")
            if self.is_production:
                raise LicenseError(f"Hardware ID generation failed: {e}")
            hardware_id = "dev-hardware-id"

        # Request validation from License Server
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.license_server_url}/api/v1/license/validate",
                    json={
                        "company_id": self.company_id,
                        "hardware_id": hardware_id,
                        "edition": os.getenv("EDITION", "core"),
                        "version": getattr(settings, 'version', '1.0.0')
                    }
                )

                if response.status_code == 200:
                    data = response.json()

                    if not data.get("valid", False):
                        error_msg = data.get("error", "License invalid")
                        logger.error(f"License validation failed: {error_msg}")
                        if self.is_production:
                            raise LicenseError(error_msg)
                        return self._dev_fallback()

                    # Validate edition match
                    license_edition = data.get("edition", "")
                    current_edition = os.getenv("EDITION", "core")
                    if license_edition != current_edition:
                        error_msg = f"Edition mismatch: license is for {license_edition}, but running {current_edition}"
                        logger.error(error_msg)
                        if self.is_production:
                            raise LicenseError(error_msg)

                    # Cache the result
                    self._set_to_cache(cache_key, data)

                    logger.info(f"License validated successfully, expires: {data.get('expires_at')}")
                    return data

                elif response.status_code == 403:
                    error_data = response.json()
                    error_msg = error_data.get("error", "License validation failed")
                    logger.error(f"License validation failed: {error_msg}")
                    if self.is_production:
                        raise LicenseError(error_msg)
                    return self._dev_fallback()

                else:
                    logger.error(f"License server returned {response.status_code}: {response.text}")
                    if self.is_production:
                        raise LicenseError(f"License server error: {response.status_code}")
                    return self._dev_fallback()

        except httpx.TimeoutException:
            logger.error("License server timeout")
            if self.is_production:
                # Grace period: check if we have recently cached valid license
                grace_key = self._get_cache_key("grace")
                grace_data = self._get_from_cache(grace_key)
                if grace_data:
                    logger.warning("Using grace period - license server unavailable but recently validated")
                    return grace_data
                raise LicenseError("License server timeout and no grace period available")
            return self._dev_fallback()

        except httpx.RequestError as e:
            logger.error(f"License server request error: {e}")
            if self.is_production:
                raise LicenseError(f"License server unavailable: {e}")
            return self._dev_fallback()

        except Exception as e:
            logger.error(f"Unexpected error during license validation: {e}")
            if self.is_production:
                raise LicenseError(f"License validation error: {e}")
            return self._dev_fallback()

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

    async def get_available_modules(self) -> List[str]:
        """
        Gets list of modules available according to license.

        Returns:
            List of module names
        """
        try:
            license_data = await self.validate_license()
            return license_data.get("modules", [])
        except LicenseError as e:
            logger.error(f"Failed to get available modules: {e}")
            return []


# Global license client instance
license_client = LicenseClient()
