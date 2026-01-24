"""
Клиент для проверки лицензий через облачный сервер
"""
import logging
from typing import Optional, List
from datetime import datetime

import httpx
import redis
from redis.exceptions import RedisError

from .config import settings

logger = logging.getLogger(__name__)

# Инициализация Redis клиента
redis_client: Optional[redis.Redis] = None

try:
    if settings.redis_url:
        redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        logger.info("Redis клиент инициализирован")
except Exception as e:
    logger.warning(f"Не удалось подключиться к Redis: {e}")
    redis_client = None


class LicenseClient:
    """Клиент для проверки лицензий"""
    
    def __init__(self):
        self.license_server_url = settings.license_server_url
        self.company_id = settings.company_id
        self.cache_ttl = settings.license_check_cache_ttl
    
    def _get_cache_key(self, company_id: str, module: str) -> str:
        """Генерирует ключ кеша"""
        return f"license:{company_id}:{module}"
    
    def _get_cache_key_modules(self, company_id: str) -> str:
        """Генерирует ключ кеша для списка модулей"""
        return f"license:modules:{company_id}"
    
    def _get_from_cache(self, key: str) -> Optional[dict]:
        """Получает значение из кеша"""
        if not redis_client:
            return None
        
        try:
            cached = redis_client.get(key)
            if cached:
                import json
                return json.loads(cached)
        except RedisError as e:
            logger.warning(f"Ошибка чтения из Redis: {e}")
        
        return None
    
    def _set_to_cache(self, key: str, value: dict, ttl: int):
        """Сохраняет значение в кеш"""
        if not redis_client:
            return
        
        try:
            import json
            redis_client.setex(key, ttl, json.dumps(value))
        except RedisError as e:
            logger.warning(f"Ошибка записи в Redis: {e}")
    
    async def check_module_access(
        self,
        company_id: Optional[str] = None,
        module: str = ""
    ) -> bool:
        """
        Проверяет доступность модуля для компании.
        
        Args:
            company_id: ID компании (если не указан, используется из настроек)
            module: Код модуля (hr, it, finance)
        
        Returns:
            True если модуль доступен, False иначе
        """
        if not self.license_server_url:
            logger.warning("LICENSE_SERVER_URL не настроен, разрешаем доступ")
            return True
        
        company_id = company_id or self.company_id
        if not company_id:
            logger.warning("COMPANY_ID не настроен, разрешаем доступ")
            return True
        
        if not module:
            logger.warning("Модуль не указан")
            return False
        
        # Проверяем кеш
        cache_key = self._get_cache_key(company_id, module)
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached.get("valid", False)
        
        # Запрашиваем у сервера лицензирования
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    f"{self.license_server_url}/api/v1/license/check",
                    json={
                        "company_id": company_id,
                        "module": module
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    valid = data.get("valid", False)
                    
                    # Сохраняем в кеш
                    self._set_to_cache(
                        cache_key,
                        {"valid": valid, "expires_at": data.get("expires_at")},
                        self.cache_ttl
                    )
                    
                    return valid
                else:
                    logger.error(
                        f"Ошибка проверки лицензии: {response.status_code} - {response.text}"
                    )
                    # При ошибке сервера разрешаем доступ (fallback)
                    return True
                    
        except httpx.TimeoutException:
            logger.warning("Таймаут при проверке лицензии, разрешаем доступ")
            return True
        except Exception as e:
            logger.error(f"Ошибка при проверке лицензии: {e}")
            # При ошибке разрешаем доступ (fallback)
            return True
    
    async def get_available_modules(
        self,
        company_id: Optional[str] = None
    ) -> List[str]:
        """
        Получает список доступных модулей для компании.
        
        Args:
            company_id: ID компании (если не указан, используется из настроек)
        
        Returns:
            Список кодов доступных модулей
        """
        if not self.license_server_url:
            logger.warning("LICENSE_SERVER_URL не настроен, возвращаем все модули")
            return settings.get_enabled_modules()
        
        company_id = company_id or self.company_id
        if not company_id:
            logger.warning("COMPANY_ID не настроен, возвращаем все модули")
            return settings.get_enabled_modules()
        
        # Проверяем кеш
        cache_key = self._get_cache_key_modules(company_id)
        cached = self._get_from_cache(cache_key)
        if cached:
            return cached.get("modules", [])
        
        # Запрашиваем у сервера лицензирования
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.license_server_url}/api/v1/license/modules/{company_id}"
                )
                
                if response.status_code == 200:
                    data = response.json()
                    modules = data.get("modules", [])
                    
                    # Сохраняем в кеш
                    self._set_to_cache(
                        cache_key,
                        {
                            "modules": modules,
                            "expires_at": data.get("expires_at")
                        },
                        self.cache_ttl
                    )
                    
                    return modules
                else:
                    logger.error(
                        f"Ошибка получения модулей: {response.status_code} - {response.text}"
                    )
                    # При ошибке возвращаем модули из настроек
                    return settings.get_enabled_modules()
                    
        except httpx.TimeoutException:
            logger.warning("Таймаут при получении модулей, возвращаем из настроек")
            return settings.get_enabled_modules()
        except Exception as e:
            logger.error(f"Ошибка при получении модулей: {e}")
            # При ошибке возвращаем модули из настроек
            return settings.get_enabled_modules()


# Глобальный экземпляр клиента
license_client = LicenseClient()
