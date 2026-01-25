"""
Telegram Bot Service
Интеграция с Telegram для уведомлений
"""

import random
import string
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User


class TelegramService:
    """Сервис для работы с Telegram Bot API"""

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
            print(f"[Telegram] Ошибка отправки сообщения: {e}")
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
            print(f"[Telegram] Ошибка получения информации о боте: {e}")

        return None

    async def check_connection(self, db: Session) -> bool:
        """Проверить подключение к Telegram"""
        info = await self.get_bot_info(db)
        return info is not None

    def generate_link_code(self) -> str:
        """Генерация 6-значного кода привязки"""
        return "".join(random.choices(string.digits, k=6))

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
