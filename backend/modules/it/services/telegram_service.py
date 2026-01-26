"""
Telegram Bot Service
Интеграция с Telegram для уведомлений + long-polling
"""

import asyncio
import logging
import random
import string
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User

logger = logging.getLogger(__name__)


class TelegramService:
    """Сервис для работы с Telegram Bot API"""

    def __init__(self):
        self._polling_task: Optional[asyncio.Task] = None
        self._polling_active = False

    # ── helpers ──────────────────────────────────────────────

    def _get_bot_token(self, db: Session) -> Optional[str]:
        """Получить токен бота из БД"""
        setting = (
            db.query(SystemSettings)
            .filter(SystemSettings.setting_key == "telegram_bot_token")
            .first()
        )
        return setting.setting_value if setting else None

    def _is_enabled(self, db: Session) -> bool:
        """Проверить включена ли интеграция"""
        setting = (
            db.query(SystemSettings)
            .filter(SystemSettings.setting_key == "telegram_bot_enabled")
            .first()
        )
        return setting and setting.setting_value.lower() == "true"

    def _get_bot_username(self, db: Session) -> Optional[str]:
        """Получить username бота"""
        setting = (
            db.query(SystemSettings)
            .filter(SystemSettings.setting_key == "telegram_bot_username")
            .first()
        )
        return setting.setting_value if setting else None

    # ── Telegram API ─────────────────────────────────────────

    async def send_message(
        self,
        db: Session,
        chat_id: int,
        text: str,
        parse_mode: str = "Markdown",
        reply_markup: Optional[dict] = None,
    ) -> bool:
        """Отправить сообщение в Telegram"""
        token = self._get_bot_token(db)
        if not token:
            return False

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
        }

        if reply_markup:
            payload["reply_markup"] = reply_markup

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, timeout=10.0)
                return response.status_code == 200
        except Exception as e:
            logger.error(f"[Telegram] Ошибка отправки сообщения: {e}")
            return False

    async def get_bot_info(self, db: Session) -> Optional[dict]:
        """Получить информацию о боте"""
        token = self._get_bot_token(db)
        if not token:
            return None

        url = f"https://api.telegram.org/bot{token}/getMe"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("ok"):
                        return data.get("result")
        except Exception as e:
            logger.error(f"[Telegram] Ошибка получения информации о боте: {e}")

        return None

    async def check_connection(self, db: Session) -> bool:
        """Проверить подключение к Telegram"""
        info = await self.get_bot_info(db)
        return info is not None

    def generate_link_code(self) -> str:
        """Генерация 6-значного кода привязки"""
        return "".join(random.choices(string.digits, k=6))

    # ── Обработка входящих обновлений ────────────────────────

    async def process_update(self, db: Session, update: dict) -> None:
        """
        Обработать одно обновление от Telegram.
        Используется и из webhook-эндпоинта, и из polling-цикла.
        """
        # Обработка входящих сообщений
        message = update.get("message")
        if message:
            chat_id = message.get("chat", {}).get("id")
            text = message.get("text", "")
            from_user = message.get("from", {})
            telegram_username = from_user.get("username")

            if text.startswith("/start"):
                parts = text.split()
                if len(parts) > 1:
                    link_code = parts[1]

                    user = (
                        db.query(User)
                        .filter(
                            User.telegram_link_code == link_code,
                            User.telegram_link_code_expires > datetime.utcnow(),
                        )
                        .first()
                    )

                    if user:
                        user.telegram_id = chat_id
                        user.telegram_username = telegram_username
                        user.telegram_notifications = True
                        user.telegram_link_code = None
                        user.telegram_link_code_expires = None
                        db.commit()

                        await self.send_message(
                            db,
                            chat_id,
                            f"Аккаунт успешно привязан к пользователю {user.full_name}!\n\n"
                            "Теперь вы будете получать уведомления о заявках.",
                        )
                    else:
                        await self.send_message(
                            db,
                            chat_id,
                            "Код привязки недействителен или истёк.\n"
                            "Получите новый код в настройках системы.",
                        )
                else:
                    await self.send_message(
                        db,
                        chat_id,
                        "Добро пожаловать!\n\n"
                        "Для привязки аккаунта получите код в разделе IT → Telegram и перейдите по ссылке с кодом.",
                    )

        # Обработка callback-кнопок
        callback_query = update.get("callback_query")
        if callback_query:
            # Подтверждаем callback, чтобы убрать «часики» в Telegram
            callback_id = callback_query.get("id")
            if callback_id:
                token = self._get_bot_token(db)
                if token:
                    try:
                        async with httpx.AsyncClient() as client:
                            await client.post(
                                f"https://api.telegram.org/bot{token}/answerCallbackQuery",
                                json={"callback_query_id": callback_id},
                                timeout=5.0,
                            )
                    except Exception:
                        pass

    # ── Long-polling ─────────────────────────────────────────

    async def _delete_webhook(self, token: str) -> None:
        """Удалить webhook, чтобы можно было использовать getUpdates"""
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"https://api.telegram.org/bot{token}/deleteWebhook",
                    json={"drop_pending_updates": False},
                    timeout=10.0,
                )
        except Exception as e:
            logger.warning(f"[Telegram] Ошибка удаления webhook: {e}")

    async def _poll_loop(self) -> None:
        """Основной цикл long-polling"""
        from backend.core.database import SessionLocal

        offset = 0
        logger.info("[Telegram] Polling запущен")

        while self._polling_active:
            db = SessionLocal()
            try:
                # Проверяем включена ли интеграция
                if not self._is_enabled(db):
                    db.close()
                    await asyncio.sleep(15)
                    continue

                token = self._get_bot_token(db)
                if not token:
                    db.close()
                    await asyncio.sleep(15)
                    continue

                # getUpdates с long-polling (timeout=30 сек)
                url = f"https://api.telegram.org/bot{token}/getUpdates"
                params = {
                    "offset": offset,
                    "timeout": 30,
                    "allowed_updates": ["message", "callback_query"],
                }

                try:
                    async with httpx.AsyncClient() as client:
                        response = await client.get(
                            url, params=params, timeout=40.0
                        )

                    if response.status_code != 200:
                        logger.warning(
                            f"[Telegram] getUpdates вернул {response.status_code}"
                        )
                        db.close()
                        await asyncio.sleep(5)
                        continue

                    data = response.json()
                    if not data.get("ok"):
                        logger.warning(
                            f"[Telegram] getUpdates error: {data.get('description')}"
                        )
                        db.close()
                        await asyncio.sleep(5)
                        continue

                    updates = data.get("result", [])
                    for upd in updates:
                        update_id = upd.get("update_id", 0)
                        try:
                            await self.process_update(db, upd)
                        except Exception as e:
                            logger.error(
                                f"[Telegram] Ошибка обработки update {update_id}: {e}"
                            )
                        offset = update_id + 1

                except httpx.TimeoutException:
                    # Нормальная ситуация для long-polling
                    pass
                except httpx.ConnectError as e:
                    logger.warning(f"[Telegram] Нет связи с api.telegram.org: {e}")
                    await asyncio.sleep(10)
                except Exception as e:
                    logger.error(f"[Telegram] Ошибка polling: {e}")
                    await asyncio.sleep(5)

            except Exception as e:
                logger.error(f"[Telegram] Критическая ошибка в poll_loop: {e}")
                await asyncio.sleep(10)
            finally:
                db.close()

        logger.info("[Telegram] Polling остановлен")

    async def start_polling(self) -> None:
        """Запустить фоновый polling"""
        if self._polling_task and not self._polling_task.done():
            return  # Уже запущен

        from backend.core.database import SessionLocal

        # Проверяем, есть ли токен и включена ли интеграция
        db = SessionLocal()
        try:
            token = self._get_bot_token(db)
            enabled = self._is_enabled(db)
        finally:
            db.close()

        if not token or not enabled:
            logger.info(
                "[Telegram] Polling не запущен: бот отключен или токен не задан"
            )
            return

        # Удаляем webhook перед началом polling
        await self._delete_webhook(token)

        self._polling_active = True
        self._polling_task = asyncio.create_task(self._poll_loop())
        logger.info("[Telegram] Фоновый polling запущен")

    async def stop_polling(self) -> None:
        """Остановить фоновый polling"""
        self._polling_active = False
        if self._polling_task and not self._polling_task.done():
            self._polling_task.cancel()
            try:
                await self._polling_task
            except asyncio.CancelledError:
                pass
        self._polling_task = None
        logger.info("[Telegram] Polling остановлен")

    async def restart_polling(self) -> None:
        """Перезапустить polling (после изменения настроек)"""
        await self.stop_polling()
        await self.start_polling()

    # ── Уведомления ──────────────────────────────────────────

    async def send_notification(
        self,
        db: Session,
        user_id: UUID,
        title: str,
        message: str,
        ticket_id: Optional[UUID] = None,
    ) -> bool:
        """Отправить уведомление пользователю"""
        if not self._is_enabled(db):
            return False

        # Получаем пользователя с telegram_id
        user = (
            db.query(User)
            .filter(
                User.id == user_id,
                User.telegram_id.isnot(None),
                User.telegram_notifications == True,
            )
            .first()
        )

        if not user or not user.telegram_id:
            return False

        # Форматируем сообщение
        text = f"*{title}*\n\n{message}"

        # Добавляем кнопку если есть ticket_id
        reply_markup = None
        if ticket_id:
            reply_markup = {
                "inline_keyboard": [
                    [
                        {
                            "text": "📋 Открыть заявку",
                            "callback_data": f"ticket_view_{ticket_id}",
                        }
                    ]
                ]
            }

        return await self.send_message(
            db, user.telegram_id, text, reply_markup=reply_markup
        )

    async def notify_new_ticket(
        self,
        db: Session,
        ticket_id: UUID,
        ticket_title: str,
    ) -> int:
        """Уведомить IT-специалистов о новой заявке"""
        if not self._is_enabled(db):
            return 0

        # Получаем всех IT-специалистов и админов с Telegram
        users = (
            db.query(User)
            .filter(
                User.telegram_id.isnot(None),
                User.telegram_notifications == True,
            )
            .all()
        )

        # Фильтруем по роли IT
        it_users = []
        for user in users:
            roles = user.roles or {}
            it_role = roles.get("it", "employee")
            if it_role in ["admin", "it_specialist"] or user.is_superuser:
                it_users.append(user)

        text = f'*🆕 Новая заявка*\n\nПоступила новая заявка: "{ticket_title}"'
        reply_markup = {
            "inline_keyboard": [
                [
                    {
                        "text": "📋 Открыть заявку",
                        "callback_data": f"ticket_view_{ticket_id}",
                    }
                ]
            ]
        }

        success_count = 0
        for user in it_users:
            if await self.send_message(
                db, user.telegram_id, text, reply_markup=reply_markup
            ):
                success_count += 1

        return success_count

    async def notify_ticket_assigned(
        self,
        db: Session,
        assignee_id: UUID,
        ticket_id: UUID,
        ticket_title: str,
    ) -> bool:
        """Уведомить о назначении заявки"""
        return await self.send_notification(
            db,
            assignee_id,
            "📌 Назначена заявка",
            f'Вам назначена заявка: "{ticket_title}"',
            ticket_id,
        )

    async def notify_ticket_status_changed(
        self,
        db: Session,
        user_id: UUID,
        ticket_id: UUID,
        ticket_title: str,
        new_status: str,
    ) -> bool:
        """Уведомить об изменении статуса заявки"""
        status_labels = {
            "new": "Новая",
            "in_progress": "В работе",
            "waiting": "Ожидание",
            "resolved": "Решена",
            "closed": "Закрыта",
        }
        status_label = status_labels.get(new_status, new_status)

        return await self.send_notification(
            db,
            user_id,
            "🔄 Статус заявки изменён",
            f'Заявка "{ticket_title}" изменила статус на "{status_label}"',
            ticket_id,
        )

    async def notify_ticket_comment(
        self,
        db: Session,
        user_id: UUID,
        ticket_id: UUID,
        ticket_title: str,
        commenter_name: str,
    ) -> bool:
        """Уведомить о новом комментарии"""
        return await self.send_notification(
            db,
            user_id,
            "💬 Новый комментарий",
            f'{commenter_name} добавил комментарий к заявке "{ticket_title}"',
            ticket_id,
        )

    async def notify_low_stock(
        self,
        db: Session,
        consumable_name: str,
        current_stock: int,
    ) -> int:
        """Уведомить о низком остатке расходников"""
        if not self._is_enabled(db):
            return 0

        # Получаем IT-специалистов
        users = (
            db.query(User)
            .filter(
                User.telegram_id.isnot(None),
                User.telegram_notifications == True,
            )
            .all()
        )

        it_users = []
        for user in users:
            roles = user.roles or {}
            it_role = roles.get("it", "employee")
            if it_role in ["admin", "it_specialist"] or user.is_superuser:
                it_users.append(user)

        text = f'*⚠️ Низкий остаток расходников*\n\nРасходник "{consumable_name}" заканчивается.\nТекущий остаток: {current_stock} шт.'

        success_count = 0
        for user in it_users:
            if await self.send_message(db, user.telegram_id, text):
                success_count += 1

        return success_count


# Singleton instance
telegram_service = TelegramService()
