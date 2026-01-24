"""
Module discovery and registry for Elements Platform.

Usage:
    from elements_common.discovery import ModuleRegistry

    registry = ModuleRegistry()
    registry.register("it", "http://backend-it:3001/api")
    registry.register("hr", "http://backend-hr:8000/api/v1")

    # Check health
    status = await registry.check_health("it")

    # Get URL if module is available
    if registry.is_available("it"):
        url = registry.get_url("it")
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class ModuleStatus(Enum):
    """Module health status."""

    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


@dataclass
class ModuleInfo:
    """Information about a registered module."""

    name: str
    base_url: str
    health_endpoint: str = "/health"
    status: ModuleStatus = ModuleStatus.UNKNOWN
    last_check: Optional[str] = None
    version: Optional[str] = None

    @property
    def health_url(self) -> str:
        """Full URL for health check."""
        return f"{self.base_url.rstrip('/')}{self.health_endpoint}"


class ModuleRegistry:
    """Registry for discovering and health-checking other modules."""

    def __init__(self, timeout: float = 5.0):
        """
        Initialize module registry.

        Args:
            timeout: HTTP timeout for health checks in seconds
        """
        self._modules: dict[str, ModuleInfo] = {}
        self.timeout = timeout

    def register(
        self, name: str, base_url: str, health_endpoint: str = "/health"
    ) -> None:
        """
        Register a module.

        Args:
            name: Module identifier (it, hr, finance)
            base_url: Base URL for the module API
            health_endpoint: Health check endpoint path
        """
        self._modules[name] = ModuleInfo(
            name=name, base_url=base_url.rstrip("/"), health_endpoint=health_endpoint
        )
        logger.info(f"[Registry] Registered module: {name} at {base_url}")

    def register_from_env(self, env_prefix: str = "MODULE") -> None:
        """
        Register modules from environment variables.

        Expected format:
            MODULE_IT_URL=http://backend-it:3001/api
            MODULE_HR_URL=http://backend-hr:8000/api/v1
            MODULE_FINANCE_URL=http://backend-finance:8002/api/v1
        """
        import os

        for key, value in os.environ.items():
            if key.startswith(f"{env_prefix}_") and key.endswith("_URL"):
                # Extract module name from key
                module_name = key[len(env_prefix) + 1 : -4].lower()
                if value:
                    self.register(module_name, value)

    async def check_health(self, module_name: str) -> ModuleStatus:
        """
        Check health of a specific module.

        Args:
            module_name: Module identifier

        Returns:
            ModuleStatus (HEALTHY, UNHEALTHY, or UNKNOWN)
        """
        module = self._modules.get(module_name)
        if not module:
            return ModuleStatus.UNKNOWN

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(module.health_url)

                if response.status_code == 200:
                    module.status = ModuleStatus.HEALTHY

                    # Try to extract version from response
                    try:
                        data = response.json()
                        module.version = data.get("version")
                    except Exception:
                        pass
                else:
                    module.status = ModuleStatus.UNHEALTHY

        except httpx.TimeoutException:
            logger.warning(f"[Registry] Health check timeout for {module_name}")
            module.status = ModuleStatus.UNHEALTHY
        except Exception as e:
            logger.warning(f"[Registry] Health check failed for {module_name}: {e}")
            module.status = ModuleStatus.UNHEALTHY

        from datetime import datetime

        module.last_check = datetime.utcnow().isoformat()

        return module.status

    async def check_all(self) -> dict[str, ModuleStatus]:
        """
        Check health of all registered modules.

        Returns:
            Dict mapping module names to their status
        """
        results = {}
        for name in self._modules:
            results[name] = await self.check_health(name)
        return results

    def is_available(self, module_name: str) -> bool:
        """
        Check if module is registered and healthy.

        Args:
            module_name: Module identifier

        Returns:
            True if module is available
        """
        module = self._modules.get(module_name)
        return module is not None and module.status == ModuleStatus.HEALTHY

    def get_url(self, module_name: str) -> Optional[str]:
        """
        Get base URL for a module if available.

        Args:
            module_name: Module identifier

        Returns:
            Base URL or None if module not registered
        """
        module = self._modules.get(module_name)
        return module.base_url if module else None

    def get_module(self, module_name: str) -> Optional[ModuleInfo]:
        """
        Get module info.

        Args:
            module_name: Module identifier

        Returns:
            ModuleInfo or None
        """
        return self._modules.get(module_name)

    def list_modules(self) -> list[ModuleInfo]:
        """
        List all registered modules.

        Returns:
            List of ModuleInfo objects
        """
        return list(self._modules.values())

    def to_dict(self) -> dict[str, dict]:
        """
        Export registry state as dictionary.

        Returns:
            Dict with module information
        """
        return {
            name: {
                "base_url": module.base_url,
                "status": module.status.value,
                "last_check": module.last_check,
                "version": module.version,
            }
            for name, module in self._modules.items()
        }
