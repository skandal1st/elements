"""
Runtime Settings Management

Manages application settings stored in database with Redis caching.
Allows configuration changes without restart.
"""

import json
import logging
from typing import Any, Optional
import redis
from sqlalchemy.orm import Session

from .config import settings
from .database import SessionLocal

logger = logging.getLogger(__name__)


class RuntimeSettings:
    """
    Manages settings from database with Redis caching

    Settings are stored in system_settings table and cached in Redis
    for fast access. Cache TTL is 60 seconds.
    """

    def __init__(self):
        self.cache_ttl = 60  # 1 minute cache
        self.redis_client: Optional[redis.Redis] = None

        # Initialize Redis connection
        try:
            if settings.redis_url:
                self.redis_client = redis.from_url(
                    settings.redis_url,
                    decode_responses=True
                )
                # Test connection
                self.redis_client.ping()
                logger.info("Runtime settings Redis cache initialized")
        except Exception as e:
            logger.warning(f"Failed to initialize Redis for runtime settings: {e}")
            logger.warning("Runtime settings will work without cache")
            self.redis_client = None

    def _get_cache_key(self, key: str) -> str:
        """Generate Redis cache key"""
        return f"runtime_settings:{key}"

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get setting value from cache or database

        Args:
            key: Setting key
            default: Default value if setting not found

        Returns:
            Setting value (parsed from string) or default
        """
        # Try Redis cache first
        if self.redis_client:
            try:
                cache_key = self._get_cache_key(key)
                cached = self.redis_client.get(cache_key)
                if cached is not None:
                    return json.loads(cached)
            except Exception as e:
                logger.warning(f"Redis cache read error for {key}: {e}")

        # Load from database
        db = SessionLocal()
        try:
            from backend.modules.hr.models.system_settings import SystemSettings

            setting = db.query(SystemSettings).filter(
                SystemSettings.key == key
            ).first()

            if setting:
                value = self._parse_value(setting.value)

                # Cache in Redis
                if self.redis_client:
                    try:
                        cache_key = self._get_cache_key(key)
                        self.redis_client.setex(
                            cache_key,
                            self.cache_ttl,
                            json.dumps(value)
                        )
                    except Exception as e:
                        logger.warning(f"Redis cache write error for {key}: {e}")

                return value
            else:
                return default

        except Exception as e:
            logger.error(f"Failed to get setting {key} from database: {e}")
            return default
        finally:
            db.close()

    def set(self, key: str, value: Any, db: Session):
        """
        Update setting value in database and invalidate cache

        Args:
            key: Setting key
            value: Setting value (will be converted to string)
            db: Database session
        """
        from backend.modules.hr.models.system_settings import SystemSettings

        # Find or create setting
        setting = db.query(SystemSettings).filter(
            SystemSettings.key == key
        ).first()

        if setting:
            setting.value = self._serialize_value(value)
        else:
            setting = SystemSettings(
                key=key,
                value=self._serialize_value(value)
            )
            db.add(setting)

        db.commit()

        # Invalidate cache
        if self.redis_client:
            try:
                cache_key = self._get_cache_key(key)
                self.redis_client.delete(cache_key)
            except Exception as e:
                logger.warning(f"Redis cache invalidation error for {key}: {e}")

        logger.info(f"Updated runtime setting: {key}")

    def delete(self, key: str, db: Session):
        """
        Delete setting from database and cache

        Args:
            key: Setting key
            db: Database session
        """
        from backend.modules.hr.models.system_settings import SystemSettings

        setting = db.query(SystemSettings).filter(
            SystemSettings.key == key
        ).first()

        if setting:
            db.delete(setting)
            db.commit()

            # Invalidate cache
            if self.redis_client:
                try:
                    cache_key = self._get_cache_key(key)
                    self.redis_client.delete(cache_key)
                except Exception as e:
                    logger.warning(f"Redis cache invalidation error for {key}: {e}")

            logger.info(f"Deleted runtime setting: {key}")

    def get_all(self, category: Optional[str] = None) -> dict:
        """
        Get all settings, optionally filtered by category

        Args:
            category: Optional category filter

        Returns:
            Dictionary of key-value pairs
        """
        db = SessionLocal()
        try:
            from backend.modules.hr.models.system_settings import SystemSettings

            query = db.query(SystemSettings)

            if category:
                query = query.filter(SystemSettings.category == category)

            settings = query.all()

            return {
                setting.key: self._parse_value(setting.value)
                for setting in settings
            }
        except Exception as e:
            logger.error(f"Failed to get all settings: {e}")
            return {}
        finally:
            db.close()

    def _parse_value(self, value: str) -> Any:
        """
        Parse setting value from string

        Supports:
        - Boolean: "true", "false" (case-insensitive)
        - Integer: numeric strings
        - JSON: valid JSON strings
        - String: everything else

        Args:
            value: String value from database

        Returns:
            Parsed value
        """
        if not value:
            return value

        # Boolean
        if value.lower() in ('true', 'false'):
            return value.lower() == 'true'

        # Integer
        try:
            return int(value)
        except ValueError:
            pass

        # Float
        try:
            return float(value)
        except ValueError:
            pass

        # JSON (list or dict)
        if value.startswith('[') or value.startswith('{'):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                pass

        # String
        return value

    def _serialize_value(self, value: Any) -> str:
        """
        Serialize value to string for database storage

        Args:
            value: Value to serialize

        Returns:
            String representation
        """
        if isinstance(value, bool):
            return 'true' if value else 'false'
        elif isinstance(value, (list, dict)):
            return json.dumps(value)
        else:
            return str(value)


# Global instance
runtime_settings = RuntimeSettings()
