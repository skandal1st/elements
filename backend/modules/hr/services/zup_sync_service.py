"""
Фоновый сервис периодической синхронизации с 1С ЗУП.

Паттерн аналогичен TelegramService / RocketChatService:
- Polling loop с configurable интервалом
- Настройки из system_settings
- Singleton instance
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from backend.modules.hr.models.system_settings import SystemSettings

logger = logging.getLogger(__name__)


class ZupSyncService:
    """Фоновый сервис синхронизации с 1С ЗУП."""

    def __init__(self):
        self._polling_task: Optional[asyncio.Task] = None
        self._polling_active = False

    def _get_setting(self, db: Session, key: str) -> Optional[str]:
        setting = (
            db.query(SystemSettings)
            .filter(SystemSettings.setting_key == key)
            .first()
        )
        return setting.setting_value if setting else None

    def _is_configured(self, db: Session) -> bool:
        enabled = self._get_setting(db, "zup_enabled")
        url = self._get_setting(db, "zup_api_url")
        username = self._get_setting(db, "zup_username")
        password = self._get_setting(db, "zup_password")
        return bool(
            enabled and enabled.lower() == "true"
            and url and username and password
        )

    def _update_setting(self, db: Session, key: str, value: str) -> None:
        setting = (
            db.query(SystemSettings)
            .filter(SystemSettings.setting_key == key)
            .first()
        )
        if setting:
            setting.setting_value = value
        else:
            setting = SystemSettings(
                setting_key=key,
                setting_value=value,
                setting_type="zup",
            )
            db.add(setting)

    async def _sync_loop(self) -> None:
        """Основной цикл периодической синхронизации."""
        from backend.core.database import SessionLocal

        logger.info("[ZUP] Background sync started")

        while self._polling_active:
            db = SessionLocal()
            try:
                if not self._is_configured(db):
                    db.close()
                    await asyncio.sleep(30)
                    continue

                # Читаем интервал
                interval_str = self._get_setting(db, "zup_sync_interval_minutes")
                interval_minutes = int(interval_str) if interval_str else 60
                interval_minutes = max(1, interval_minutes)

                # Выполняем синхронизацию
                from backend.modules.hr.services.zup import sync_all_from_zup

                logger.info("[ZUP] Starting scheduled sync...")
                result = sync_all_from_zup(db)

                # Сохраняем результат
                self._update_setting(db, "zup_last_sync", datetime.utcnow().isoformat())
                self._update_setting(
                    db,
                    "zup_last_sync_result",
                    json.dumps(result, ensure_ascii=False, default=str),
                )
                db.commit()

                emp = result.get("employees", {})
                logger.info(
                    f"[ZUP] Sync completed: employees created={emp.get('created', 0)}, "
                    f"updated={emp.get('updated', 0)}, hired={emp.get('hired', 0)}, "
                    f"fired={emp.get('fired', 0)}, position_changed={emp.get('position_changed', 0)}"
                )

                db.close()
                await asyncio.sleep(interval_minutes * 60)

            except Exception as e:
                logger.error(f"[ZUP] Sync error: {e}")
                db.close()
                await asyncio.sleep(60)

        logger.info("[ZUP] Background sync stopped")

    async def start_polling(self) -> None:
        """Запустить фоновую синхронизацию."""
        if self._polling_task and not self._polling_task.done():
            return

        from backend.core.database import SessionLocal

        db = SessionLocal()
        try:
            if not self._is_configured(db):
                logger.info("[ZUP] Background sync not started: not configured or disabled")
                return
        finally:
            db.close()

        self._polling_active = True
        self._polling_task = asyncio.create_task(self._sync_loop())
        logger.info("[ZUP] Background sync task created")

    async def stop_polling(self) -> None:
        """Остановить фоновую синхронизацию."""
        self._polling_active = False
        if self._polling_task and not self._polling_task.done():
            self._polling_task.cancel()
            try:
                await self._polling_task
            except asyncio.CancelledError:
                pass
        self._polling_task = None
        logger.info("[ZUP] Background sync stopped")

    async def restart_polling(self) -> None:
        """Перезапустить синхронизацию (после изменения настроек)."""
        await self.stop_polling()
        await self.start_polling()


# Singleton
zup_sync_service = ZupSyncService()
