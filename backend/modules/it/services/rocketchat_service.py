"""
RocketChat Service
Интеграция с RocketChat CE для создания тикетов через Outgoing Webhook
и отправки уведомлений обратно в канал.
"""

import logging
from typing import Optional
from uuid import UUID

import httpx
from sqlalchemy.orm import Session

from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User
from backend.modules.it.models import Ticket, TicketComment

logger = logging.getLogger(__name__)


class RocketChatService:
    """Сервис для работы с RocketChat REST API"""

    def __init__(self):
        self._channel_id: Optional[str] = None

    # ── helpers ──────────────────────────────────────────────

    def _get_setting(self, db: Session, key: str) -> Optional[str]:
        setting = (
            db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
        )
        return setting.setting_value if setting else None

    def _is_enabled(self, db: Session) -> bool:
        value = self._get_setting(db, "rocketchat_enabled")
        return bool(value and value.lower() == "true")

    def _get_auth_headers(self, db: Session) -> Optional[dict]:
        """Возвращает заголовки авторизации для RocketChat REST API."""
        user_id = self._get_setting(db, "rocketchat_user_id")
        auth_token = self._get_setting(db, "rocketchat_auth_token")
        if not user_id or not auth_token:
            return None
        return {
            "X-Auth-Token": auth_token,
            "X-User-Id": user_id,
        }

    def _get_base_url(self, db: Session) -> Optional[str]:
        url = self._get_setting(db, "rocketchat_url")
        if url:
            return url.rstrip("/")
        return None

    def _get_public_app_url(self, db: Session) -> Optional[str]:
        raw = (self._get_setting(db, "public_app_url") or "").strip()
        if raw:
            return raw.rstrip("/")
        return None

    def _ticket_url(self, db: Session, ticket_id: UUID) -> Optional[str]:
        base = self._get_public_app_url(db)
        if not base:
            return None
        return f"{base}/it/tickets?open={ticket_id}"

    # ── RocketChat API ───────────────────────────────────────

    async def check_connection(self, db: Session) -> bool:
        """Проверить подключение к RocketChat (GET /api/v1/me)."""
        base_url = self._get_base_url(db)
        headers = self._get_auth_headers(db)
        if not base_url or not headers:
            return False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{base_url}/api/v1/me",
                    headers=headers,
                )
                if response.status_code == 200:
                    data = response.json()
                    return data.get("success", False)
        except Exception as e:
            logger.error(f"[RocketChat] Ошибка проверки подключения: {e}")

        return False

    async def get_channel_id(self, db: Session, channel_name: Optional[str] = None) -> Optional[str]:
        """Получить ID канала по имени. Кэширует результат."""
        if self._channel_id:
            return self._channel_id

        base_url = self._get_base_url(db)
        headers = self._get_auth_headers(db)
        if not base_url or not headers:
            return None

        name = channel_name or self._get_setting(db, "rocketchat_channel_name")
        if not name:
            return None
        # Убираем # если есть
        name = name.lstrip("#")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{base_url}/api/v1/channels.info",
                    headers=headers,
                    params={"roomName": name},
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        self._channel_id = data["channel"]["_id"]
                        return self._channel_id
        except Exception as e:
            logger.error(f"[RocketChat] Ошибка получения ID канала '{name}': {e}")

        return None

    async def send_channel_message(self, db: Session, text: str) -> bool:
        """Отправить сообщение в настроенный канал."""
        if not self._is_enabled(db):
            return False

        base_url = self._get_base_url(db)
        headers = self._get_auth_headers(db)
        if not base_url or not headers:
            return False

        rid = await self.get_channel_id(db)
        if not rid:
            logger.warning("[RocketChat] Не удалось получить ID канала для отправки сообщения")
            return False

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{base_url}/api/v1/chat.sendMessage",
                    headers=headers,
                    json={"message": {"rid": rid, "msg": text}},
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"[RocketChat] Ошибка отправки сообщения: {e}")
            return False

    # ── Обработка Webhook ────────────────────────────────────

    async def process_webhook_message(self, db: Session, payload: dict) -> Optional[dict]:
        """
        Обработать входящий Outgoing Webhook от RocketChat.

        Возвращает dict с ключом "text" для ответа в канал, или None.
        """
        # Валидация тока webhook
        expected_token = self._get_setting(db, "rocketchat_webhook_token")
        incoming_token = payload.get("token")
        if not expected_token or incoming_token != expected_token:
            logger.warning("[RocketChat] Невалидный webhook token")
            return None

        # Валидация канала
        expected_channel = self._get_setting(db, "rocketchat_channel_name")
        channel_name = payload.get("channel_name", "")
        if expected_channel:
            expected_clean = expected_channel.lstrip("#")
            incoming_clean = channel_name.lstrip("#")
            if expected_clean != incoming_clean:
                logger.warning(
                    f"[RocketChat] Сообщение из неожиданного канала: {channel_name}"
                )
                return None

        # Игнор сообщений бота (предотвращение петли)
        bot_user_id = self._get_setting(db, "rocketchat_bot_user_id")
        user_id = payload.get("user_id", "")
        user_name = payload.get("user_name", "")
        is_bot = payload.get("bot", False)

        if is_bot:
            return None
        if bot_user_id and user_id == bot_user_id:
            return None

        message_id = payload.get("message_id", "")
        text = (payload.get("text") or "").strip()
        tmid = payload.get("tmid")  # ID родительского сообщения (тред)

        if not text:
            return None

        # Дедупликация по rocketchat_message_id
        if message_id:
            existing = (
                db.query(Ticket)
                .filter(Ticket.rocketchat_message_id == message_id)
                .first()
            )
            if existing:
                short_id = str(existing.id)[:8]
                return {"text": f"Заявка #{short_id} уже существует"}

        # Если тред — добавляем комментарий к существующему тикету
        if tmid:
            return await self._add_comment_from_thread(db, tmid, text, user_name)

        # Создаём новый тикет
        return await self._create_ticket_from_message(db, text, user_name, message_id)

    async def _add_comment_from_thread(
        self, db: Session, tmid: str, text: str, rc_username: str
    ) -> Optional[dict]:
        """Добавить комментарий к тикету из тредового сообщения."""
        ticket = (
            db.query(Ticket)
            .filter(Ticket.rocketchat_message_id == tmid)
            .first()
        )
        if not ticket:
            return None

        # Ищем пользователя по username
        user = db.query(User).filter(User.username == rc_username).first()
        if not user:
            # Пробуем без учёта регистра
            user = db.query(User).filter(User.username.ilike(rc_username)).first()

        if not user:
            logger.info(
                f"[RocketChat] Пользователь '{rc_username}' не найден, комментарий не добавлен"
            )
            return {"text": f"Пользователь @{rc_username} не найден в системе"}

        comment = TicketComment(
            ticket_id=ticket.id,
            user_id=user.id,
            content=text,
        )
        db.add(comment)
        db.commit()

        short_id = str(ticket.id)[:8]
        return {"text": f"Комментарий добавлен к заявке #{short_id}"}

    async def _create_ticket_from_message(
        self, db: Session, text: str, rc_username: str, message_id: str
    ) -> Optional[dict]:
        """Создать тикет из сообщения в канале."""
        # Первая строка -> title (до 255 символов), весь текст -> description
        lines = text.split("\n", 1)
        title = lines[0][:255].strip()
        description = text

        if not title:
            title = "Заявка из RocketChat"

        # Маппинг пользователя
        user = db.query(User).filter(User.username == rc_username).first()
        if not user:
            user = db.query(User).filter(User.username.ilike(rc_username)).first()

        ticket = Ticket(
            title=title,
            description=description,
            category="other",
            priority="medium",
            source="rocketchat",
            rocketchat_message_id=message_id or None,
            rocketchat_sender=rc_username,
        )

        if user:
            ticket.creator_id = user.id
            ticket.status = "new"
        else:
            ticket.status = "pending_user"

        db.add(ticket)
        db.commit()
        db.refresh(ticket)

        short_id = str(ticket.id)[:8]

        # Уведомляем IT-специалистов в Telegram
        try:
            from backend.modules.it.services.telegram_service import telegram_service
            await telegram_service.notify_new_ticket(db, ticket.id, ticket.title)
        except Exception:
            pass

        url = self._ticket_url(db, ticket.id)
        if url:
            return {"text": f"Заявка #{short_id} создана\n{url}"}
        return {"text": f"Заявка #{short_id} создана"}

    # ── Уведомления ──────────────────────────────────────────

    async def notify_ticket_status_changed(
        self, db: Session, ticket: Ticket
    ) -> bool:
        """Уведомить в канале об изменении статуса тикета."""
        if not self._is_enabled(db) or not ticket.rocketchat_sender:
            return False

        status_labels = {
            "new": "Новая",
            "in_progress": "В работе",
            "waiting": "Ожидание",
            "resolved": "Решена",
            "closed": "Закрыта",
            "pending_user": "Ожидает привязки",
        }
        status_label = status_labels.get(ticket.status, ticket.status)
        short_id = str(ticket.id)[:8]
        text = f"@{ticket.rocketchat_sender} Статус заявки #{short_id} изменён на «{status_label}»"

        url = self._ticket_url(db, ticket.id)
        if url:
            text += f"\n{url}"

        return await self.send_channel_message(db, text)

    async def notify_ticket_assigned(
        self, db: Session, ticket: Ticket, assignee_name: str
    ) -> bool:
        """Уведомить в канале о назначении исполнителя."""
        if not self._is_enabled(db) or not ticket.rocketchat_sender:
            return False

        short_id = str(ticket.id)[:8]
        text = f"@{ticket.rocketchat_sender} По заявке #{short_id} назначен исполнитель: {assignee_name}"

        url = self._ticket_url(db, ticket.id)
        if url:
            text += f"\n{url}"

        return await self.send_channel_message(db, text)

    async def notify_ticket_comment(
        self, db: Session, ticket: Ticket, commenter_name: str
    ) -> bool:
        """Уведомить в канале о новом комментарии."""
        if not self._is_enabled(db) or not ticket.rocketchat_sender:
            return False

        short_id = str(ticket.id)[:8]
        text = f"@{ticket.rocketchat_sender} Новый комментарий к заявке #{short_id} от {commenter_name}"

        url = self._ticket_url(db, ticket.id)
        if url:
            text += f"\n{url}"

        return await self.send_channel_message(db, text)


# Singleton instance
rocketchat_service = RocketChatService()
