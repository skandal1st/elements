"""
RocketChat Service
Интеграция с RocketChat CE для создания тикетов и отправки уведомлений в канал.

Основной режим — polling (Elements опрашивает RocketChat через REST API channels.history).
Webhook-режим доступен как альтернатива, если RocketChat может достучаться до Elements.
"""

import asyncio
import json
import logging
import secrets
from datetime import datetime, timezone
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
        self._channel_type: Optional[str] = None  # "channels" или "groups"
        self._notify_channel_id: Optional[str] = None
        self._notify_channel_type: Optional[str] = None
        self._polling_task: Optional[asyncio.Task] = None
        self._polling_active = False
        self._last_processed_ts: Optional[str] = None
        self._processed_ids: set = set()
        self._ts_by_room: dict = {}  # room_id -> last processed timestamp (DM-режим)

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
        """Получить ID канала по имени. Пробует public (channels) и private (groups). Кэширует."""
        if self._channel_id:
            return self._channel_id

        base_url = self._get_base_url(db)
        headers = self._get_auth_headers(db)
        if not base_url or not headers:
            return None

        name = channel_name or self._get_setting(db, "rocketchat_channel_name")
        if not name:
            logger.warning("[RocketChat] Имя канала не задано в настройках")
            return None
        # Убираем # если есть
        name = name.lstrip("#")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Сначала пробуем публичный канал (channels)
                response = await client.get(
                    f"{base_url}/api/v1/channels.info",
                    headers=headers,
                    params={"roomName": name},
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        self._channel_id = data["channel"]["_id"]
                        self._channel_type = "channels"
                        logger.info(f"[RocketChat] Канал '{name}' найден (public), ID: {self._channel_id}")
                        return self._channel_id

                # Если не найден — пробуем приватную группу (groups)
                response = await client.get(
                    f"{base_url}/api/v1/groups.info",
                    headers=headers,
                    params={"roomName": name},
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        self._channel_id = data["group"]["_id"]
                        self._channel_type = "groups"
                        logger.info(f"[RocketChat] Канал '{name}' найден (private group), ID: {self._channel_id}")
                        return self._channel_id

                logger.warning(f"[RocketChat] Канал '{name}' не найден ни как public, ни как private group")
        except Exception as e:
            logger.error(f"[RocketChat] Ошибка получения ID канала '{name}': {e}")

        return None

    async def _get_notify_channel_id(self, db: Session) -> Optional[str]:
        """ID канала для уведомлений. Если не задан отдельно — использует основной канал."""
        notify_name = self._get_setting(db, "rocketchat_notify_channel_name")
        if not notify_name:
            return await self.get_channel_id(db)

        if self._notify_channel_id:
            return self._notify_channel_id

        base_url = self._get_base_url(db)
        headers = self._get_auth_headers(db)
        if not base_url or not headers:
            return None

        name = notify_name.lstrip("#")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                for endpoint, key in [("channels.info", "channel"), ("groups.info", "group")]:
                    response = await client.get(
                        f"{base_url}/api/v1/{endpoint}",
                        headers=headers,
                        params={"roomName": name},
                    )
                    if response.status_code == 200:
                        data = response.json()
                        if data.get("success"):
                            self._notify_channel_id = data[key]["_id"]
                            self._notify_channel_type = "channels" if key == "channel" else "groups"
                            logger.info(f"[RocketChat] Канал уведомлений '{name}' найден, ID: {self._notify_channel_id}")
                            return self._notify_channel_id
            logger.warning(f"[RocketChat] Канал уведомлений '{name}' не найден")
        except Exception as e:
            logger.error(f"[RocketChat] Ошибка получения ID канала уведомлений: {e}")
        return None

    async def send_notify_message(self, db: Session, text: str) -> bool:
        """Отправить уведомление в канал уведомлений (отдельный от канала заявок)."""
        if not self._is_enabled(db):
            return False

        base_url = self._get_base_url(db)
        headers = self._get_auth_headers(db)
        if not base_url or not headers:
            return False

        rid = await self._get_notify_channel_id(db)
        if not rid:
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
            logger.error(f"[RocketChat] Ошибка отправки уведомления: {e}")
            return False

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

    async def _send_dm(self, db: Session, room_id: str, text: str) -> bool:
        """Отправить личное сообщение пользователю по room_id DM-комнаты."""
        base_url = self._get_base_url(db)
        headers = self._get_auth_headers(db)
        if not base_url or not headers or not room_id:
            return False
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{base_url}/api/v1/chat.sendMessage",
                    headers=headers,
                    json={"message": {"rid": room_id, "msg": text}},
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"[RocketChat] Ошибка отправки DM: {e}")
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
        self, db: Session, tmid: str, text: str, rc_username: str,
        room_id: Optional[str] = None,
    ) -> Optional[dict]:
        """Добавить комментарий к тикету из тредового сообщения."""
        ticket = (
            db.query(Ticket)
            .filter(Ticket.rocketchat_message_id == tmid)
            .first()
        )
        if not ticket:
            return None

        user = db.query(User).filter(User.username == rc_username).first()
        if not user:
            user = db.query(User).filter(User.username.ilike(rc_username)).first()

        if not user:
            logger.info(f"[RocketChat] Пользователь '{rc_username}' не найден, комментарий не добавлен")
            reply = f"Пользователь @{rc_username} не найден в системе"
            if room_id:
                await self._send_dm(db, room_id, reply)
            return {"text": reply}

        comment = TicketComment(
            ticket_id=ticket.id,
            user_id=user.id,
            content=text,
        )
        db.add(comment)
        db.commit()

        short_id = str(ticket.id)[:8]
        reply = f"Комментарий добавлен к заявке #{short_id}"
        if room_id:
            await self._send_dm(db, room_id, reply)
        return {"text": reply}

    async def _create_ticket_from_message(
        self, db: Session, text: str, rc_username: str, message_id: str,
        room_id: Optional[str] = None,
    ) -> Optional[dict]:
        """Создать тикет из DM или сообщения в канале."""
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
            rocketchat_room_id=room_id or None,
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

        # Автоназначение на IT-специалиста (с учётом настроек)
        try:
            from backend.modules.hr.models.system_settings import SystemSettings
            _cfg_rows = (
                db.query(SystemSettings.setting_key, SystemSettings.setting_value)
                .filter(SystemSettings.setting_key.in_([
                    "auto_assign_tickets", "ticket_distribution_method", "ticket_distribution_specialists",
                ]))
                .all()
            )
            _cfg = {k: (v or "") for k, v in _cfg_rows}
            _auto = str(_cfg.get("auto_assign_tickets", "false")).lower() in ("true", "1", "yes")

            assignee = None
            if _auto:
                from backend.modules.it.services.telegram_service import telegram_service
                assignee = telegram_service.auto_assign_to_it_specialist(
                    db, ticket,
                    method=_cfg.get("ticket_distribution_method", "least_loaded"),
                    specialist_ids_json=_cfg.get("ticket_distribution_specialists") or None,
                )
                if assignee:
                    db.commit()
                    db.refresh(ticket)

                # Уведомляем IT-специалистов в Telegram
                await telegram_service.notify_new_ticket(db, ticket.id, ticket.title, source="rocketchat")

                # Уведомляем назначенного специалиста
                if assignee and assignee.telegram_id:
                    await telegram_service.notify_ticket_assigned(db, assignee.id, ticket.id, ticket.title)
        except Exception as e:
            print(f"[RocketChat] Ошибка автоназначения/уведомлений: {e}")

        url = self._ticket_url(db, ticket.id)
        reply = f"Ваша заявка #{short_id} принята\n{url}" if url else f"Ваша заявка #{short_id} принята"
        if room_id:
            await self._send_dm(db, room_id, reply)
        return {"text": reply}

    # ── Polling ─────────────────────────────────────────────

    async def _poll_dm_loop(self) -> None:
        """
        Polling входящих DM (личных сообщений боту).
        Каждые 10с получает im.list, находит комнаты с новыми сообщениями,
        опрашивает im.history для каждой из них.
        """
        from backend.core.database import SessionLocal

        POLL_INTERVAL = 10
        MAX_PROCESSED_IDS = 2000

        start_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        self._ts_by_room = {}   # room_id -> last processed ts
        self._processed_ids = set()

        logger.info("[RocketChat] DM-polling запущен")

        while self._polling_active:
            db = SessionLocal()
            try:
                if not self._is_enabled(db):
                    await asyncio.sleep(15)
                    continue

                base_url = self._get_base_url(db)
                headers = self._get_auth_headers(db)
                if not base_url or not headers:
                    await asyncio.sleep(15)
                    continue

                bot_user_id = self._get_setting(db, "rocketchat_bot_user_id")

                # 1. Получаем список всех DM-комнат бота
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.get(
                            f"{base_url}/api/v1/im.list",
                            headers=headers,
                            params={"count": 200},
                        )
                    if resp.status_code != 200 or not resp.json().get("success"):
                        await asyncio.sleep(POLL_INTERVAL)
                        continue
                    dm_rooms = resp.json().get("ims", [])
                except httpx.ConnectError as e:
                    logger.warning(f"[RocketChat] Нет связи: {e}")
                    await asyncio.sleep(POLL_INTERVAL)
                    continue
                except httpx.TimeoutException:
                    await asyncio.sleep(POLL_INTERVAL)
                    continue

                # 2. Для каждой DM-комнаты опрашиваем историю
                for room in dm_rooms:
                    room_id = room.get("_id", "")
                    if not room_id:
                        continue

                    # Используем start_ts для новых комнат (не обрабатываем старые сообщения)
                    oldest = self._ts_by_room.get(room_id, start_ts)

                    try:
                        async with httpx.AsyncClient(timeout=10.0) as client:
                            resp = await client.get(
                                f"{base_url}/api/v1/im.history",
                                headers=headers,
                                params={"roomId": room_id, "oldest": oldest, "count": 50},
                            )
                        if resp.status_code != 200 or not resp.json().get("success"):
                            continue

                        messages = resp.json().get("messages", [])
                        messages.sort(key=lambda m: m.get("ts", ""))

                        for msg in messages:
                            msg_id = msg.get("_id", "")
                            if msg_id in self._processed_ids:
                                continue

                            msg_ts = msg.get("ts", "")
                            user_info = msg.get("u", {})
                            sender_id = user_info.get("_id", "")
                            username = user_info.get("username", "")
                            text = (msg.get("msg") or "").strip()
                            tmid = msg.get("tmid")

                            # Пропускаем системные и сообщения бота
                            if msg.get("t") or msg.get("bot"):
                                self._processed_ids.add(msg_id)
                                if msg_ts:
                                    self._ts_by_room[room_id] = msg_ts
                                continue
                            if bot_user_id and sender_id == bot_user_id:
                                self._processed_ids.add(msg_id)
                                if msg_ts:
                                    self._ts_by_room[room_id] = msg_ts
                                continue
                            if not text:
                                self._processed_ids.add(msg_id)
                                if msg_ts:
                                    self._ts_by_room[room_id] = msg_ts
                                continue

                            try:
                                # Дедупликация по БД
                                existing = (
                                    db.query(Ticket)
                                    .filter(Ticket.rocketchat_message_id == msg_id)
                                    .first()
                                )
                                if existing:
                                    self._processed_ids.add(msg_id)
                                    if msg_ts:
                                        self._ts_by_room[room_id] = msg_ts
                                    continue

                                if tmid:
                                    await self._add_comment_from_thread(
                                        db, tmid, text, username, room_id=room_id
                                    )
                                else:
                                    await self._create_ticket_from_message(
                                        db, text, username, msg_id, room_id=room_id
                                    )
                            except Exception as e:
                                logger.error(f"[RocketChat] Ошибка обработки DM {msg_id}: {e}")

                            self._processed_ids.add(msg_id)
                            if msg_ts:
                                self._ts_by_room[room_id] = msg_ts

                    except Exception as e:
                        logger.error(f"[RocketChat] Ошибка polling DM room {room_id}: {e}")

                # Ограничиваем размер кэша обработанных ID
                if len(self._processed_ids) > MAX_PROCESSED_IDS:
                    self._processed_ids = set(
                        list(self._processed_ids)[-MAX_PROCESSED_IDS // 2:]
                    )

            except Exception as e:
                logger.error(f"[RocketChat] Критическая ошибка DM poll_loop: {e}")
            finally:
                db.close()

            await asyncio.sleep(POLL_INTERVAL)

        logger.info("[RocketChat] DM-polling остановлен")

    async def start_polling(self) -> None:
        """Запустить фоновый polling."""
        if self._polling_task and not self._polling_task.done():
            return  # Уже запущен

        from backend.core.database import SessionLocal

        db = SessionLocal()
        try:
            enabled = self._is_enabled(db)
            base_url = self._get_base_url(db)
            headers = self._get_auth_headers(db)
        finally:
            db.close()

        if not enabled or not base_url or not headers:
            logger.info(
                "[RocketChat] Polling не запущен: интеграция отключена или не настроена"
            )
            return

        self._polling_active = True
        self._polling_task = asyncio.create_task(self._poll_dm_loop())
        logger.info("[RocketChat] Фоновый DM-polling запущен")

    async def stop_polling(self) -> None:
        """Остановить фоновый polling."""
        self._polling_active = False
        if self._polling_task and not self._polling_task.done():
            self._polling_task.cancel()
            try:
                await self._polling_task
            except asyncio.CancelledError:
                pass
        self._polling_task = None
        logger.info("[RocketChat] Polling остановлен")

    async def restart_polling(self) -> None:
        """Перезапустить polling (после изменения настроек)."""
        await self.stop_polling()
        # Сбрасываем кэш каналов — настройки могли измениться
        self._channel_id = None
        self._channel_type = None
        self._notify_channel_id = None
        self._notify_channel_type = None
        self._ts_by_room = {}
        await self.start_polling()

    # ── Уведомления ──────────────────────────────────────────

    async def notify_new_ticket(self, db: Session, ticket: "Ticket") -> bool:
        """Уведомить в канале о создании новой заявки."""
        if not self._is_enabled(db):
            return False

        priority_labels = {
            "low": "Низкий",
            "medium": "Средний",
            "high": "Высокий",
            "critical": "Критический",
        }
        category_labels = {
            "hardware": "Оборудование",
            "software": "ПО",
            "network": "Сеть",
            "access": "Доступ",
            "other": "Другое",
        }
        source_labels = {
            "web": "Веб",
            "email": "Email",
            "telegram": "Telegram",
            "rocketchat": "RocketChat",
            "api": "API",
        }

        short_id = str(ticket.id)[:8]
        priority = priority_labels.get(ticket.priority or "medium", ticket.priority or "—")
        category = category_labels.get(ticket.category or "other", ticket.category or "—")
        source = source_labels.get(ticket.source or "web", ticket.source or "—")

        requester = "—"
        if ticket.employee_id:
            from backend.modules.hr.models.employee import Employee
            emp = db.query(Employee).filter(Employee.id == ticket.employee_id).first()
            if emp:
                requester = emp.full_name
        if requester == "—" and ticket.rocketchat_sender:
            requester = f"@{ticket.rocketchat_sender}"
        if requester == "—" and ticket.email_sender:
            requester = ticket.email_sender

        lines = [
            f"*Новая заявка #{short_id}*",
            f"*{ticket.title}*",
            f"Инициатор: {requester}",
            f"Категория: {category} | Приоритет: {priority} | Источник: {source}",
        ]

        url = self._ticket_url(db, ticket.id)
        if url:
            lines.append(url)

        return await self.send_notify_message(db, "\n".join(lines))

    async def notify_ticket_status_changed(
        self, db: Session, ticket: Ticket
    ) -> bool:
        """Уведомить пользователя в DM и IT-канал об изменении статуса."""
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
        url = self._ticket_url(db, ticket.id)

        # DM пользователю
        if ticket.rocketchat_room_id:
            dm_text = f"Статус вашей заявки #{short_id} изменён на «{status_label}»"
            if url:
                dm_text += f"\n{url}"
            await self._send_dm(db, ticket.rocketchat_room_id, dm_text)

        # Уведомление в IT-канал
        notify_text = f"@{ticket.rocketchat_sender} Заявка #{short_id}: статус изменён на «{status_label}»"
        if url:
            notify_text += f"\n{url}"
        return await self.send_notify_message(db, notify_text)

    async def notify_ticket_assigned(
        self, db: Session, ticket: Ticket, assignee_name: str
    ) -> bool:
        """Уведомить пользователя в DM и IT-канал о назначении исполнителя."""
        if not self._is_enabled(db) or not ticket.rocketchat_sender:
            return False

        short_id = str(ticket.id)[:8]
        url = self._ticket_url(db, ticket.id)

        if ticket.rocketchat_room_id:
            dm_text = f"По вашей заявке #{short_id} назначен исполнитель: {assignee_name}"
            if url:
                dm_text += f"\n{url}"
            await self._send_dm(db, ticket.rocketchat_room_id, dm_text)

        notify_text = f"Заявка #{short_id} (@{ticket.rocketchat_sender}): назначен {assignee_name}"
        if url:
            notify_text += f"\n{url}"
        return await self.send_notify_message(db, notify_text)

    async def notify_ticket_comment(
        self, db: Session, ticket: Ticket, commenter_name: str
    ) -> bool:
        """Уведомить пользователя в DM о новом комментарии к его заявке."""
        if not self._is_enabled(db) or not ticket.rocketchat_sender:
            return False

        short_id = str(ticket.id)[:8]
        url = self._ticket_url(db, ticket.id)

        if ticket.rocketchat_room_id:
            dm_text = f"Новый комментарий к заявке #{short_id} от {commenter_name}"
            if url:
                dm_text += f"\n{url}"
            await self._send_dm(db, ticket.rocketchat_room_id, dm_text)
            return True

        # Fallback: IT-канал если нет room_id (старые заявки из канала)
        notify_text = f"@{ticket.rocketchat_sender} Новый комментарий к заявке #{short_id} от {commenter_name}"
        if url:
            notify_text += f"\n{url}"
        return await self.send_notify_message(db, notify_text)

    # ── SSO / iframe embedding ────────────────────────────────

    async def get_user_sso_token(
        self, db: Session, user_email: str, user_display_name: str
    ) -> Optional[dict]:
        """Создать или найти пользователя в RC и вернуть login token для iframe SSO."""
        base_url = self._get_base_url(db)
        headers = self._get_auth_headers(db)
        if not base_url or not headers:
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Найти пользователя по email
                r = await client.get(
                    f"{base_url}/api/v1/users.list",
                    headers=headers,
                    params={"query": json.dumps({"emails.address": user_email})},
                )
                users = r.json().get("users", [])

                if users:
                    rc_user_id = users[0]["_id"]
                else:
                    # Создать пользователя автоматически
                    username = user_email.split("@")[0]
                    cr = await client.post(
                        f"{base_url}/api/v1/users.create",
                        headers=headers,
                        json={
                            "email": user_email,
                            "name": user_display_name,
                            "username": username,
                            "password": secrets.token_hex(16),
                            "verified": True,
                        },
                    )
                    cr_data = cr.json()
                    if not cr_data.get("success"):
                        logger.error(f"[RocketChat SSO] Не удалось создать пользователя {user_email}: {cr_data}")
                        return None
                    rc_user_id = cr_data.get("user", {}).get("_id")
                    if not rc_user_id:
                        return None

                # Создать одноразовый login token
                tr = await client.post(
                    f"{base_url}/api/v1/users.createToken",
                    headers=headers,
                    json={"userId": rc_user_id},
                )
                token_data = tr.json().get("data", {})
                login_token = token_data.get("authToken")
                if not login_token:
                    logger.error(f"[RocketChat SSO] Не удалось создать token для {user_email}")
                    return None

                return {
                    "rocketchat_url": base_url,
                    "login_token": login_token,
                    "user_id": rc_user_id,
                }
        except Exception as e:
            logger.error(f"[RocketChat SSO] Ошибка: {e}")
            return None


    # ── Proxy (REST от имени пользователя) ───────────────────

    def _get_user_headers(self, rc_user_id: str, rc_token: str) -> dict:
        return {"X-Auth-Token": rc_token, "X-User-Id": rc_user_id}

    async def get_or_create_user_token(
        self, db: Session, user
    ) -> Optional[tuple]:
        """
        Возвращает (rc_user_id, rc_token) для пользователя Elements.
        Создаёт/обновляет токен через бот-credentials если отсутствует или старше 7 дней.
        """
        from datetime import timedelta
        from backend.modules.it.models import UserRcToken

        TOKEN_TTL_DAYS = 7

        record = db.query(UserRcToken).filter(UserRcToken.user_id == user.id).first()
        now = datetime.now(timezone.utc)

        if record:
            age = now - record.updated_at.replace(tzinfo=timezone.utc)
            if age < timedelta(days=TOKEN_TTL_DAYS):
                return (record.rc_user_id, record.rc_token)

        base_url = self._get_base_url(db)
        headers = self._get_auth_headers(db)
        if not base_url or not headers:
            logger.error(f"[RocketChat] get_or_create_user_token: нет base_url или headers")
            return None

        # Пароль неизвестен — нужна явная авторизация пользователя через /chat/connect
        logger.info(f"[RocketChat] Нет сохранённого пароля для {user.email}, требуется rc_login")
        return None

    async def connect_user_with_password(
        self, db: Session, user, rc_password: str
    ) -> Optional[tuple]:
        """
        Авторизует пользователя в RC с его паролем, сохраняет токен.
        Вызывается из POST /chat/connect когда пользователь вводит пароль вручную.
        """
        from backend.modules.it.models import UserRcToken

        base_url = self._get_base_url(db)
        if not base_url:
            return None

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                lr = await client.post(
                    f"{base_url}/api/v1/login",
                    json={"user": user.email, "password": rc_password},
                )
                login_data = lr.json().get("data", {})
                rc_token = login_data.get("authToken")
                rc_user_id = login_data.get("userId")

                if not rc_token or not rc_user_id:
                    err = lr.json().get("error", "неизвестная ошибка")
                    logger.warning(f"[RocketChat] Логин {user.email} не удался: {err}")
                    return None

            logger.info(f"[RocketChat] Логин успешен: {user.email} → rc_id={rc_user_id}")

            now = datetime.now(timezone.utc)
            record = db.query(UserRcToken).filter(UserRcToken.user_id == user.id).first()
            if record:
                record.rc_user_id = rc_user_id
                record.rc_token = rc_token
                record.rc_password = rc_password
                record.updated_at = now
            else:
                record = UserRcToken(
                    user_id=user.id,
                    rc_user_id=rc_user_id,
                    rc_token=rc_token,
                    rc_password=rc_password,
                )
                db.add(record)
            db.commit()
            return (rc_user_id, rc_token)

        except Exception as e:
            logger.error(f"[RocketChat] connect_user_with_password {user.email}: {e}")
            return None

    async def proxy_get_rooms(
        self, db: Session, rc_user_id: str, rc_token: str
    ) -> list:
        """Список комнат пользователя: каналы, приватные группы, DM."""
        base_url = self._get_base_url(db)
        if not base_url:
            return []

        headers = self._get_user_headers(rc_user_id, rc_token)
        rooms = []

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Подписки содержат unread counts и последние сообщения
                subs_r = await client.get(
                    f"{base_url}/api/v1/subscriptions.get",
                    headers=headers,
                )
                if subs_r.status_code == 200 and subs_r.json().get("success"):
                    for sub in subs_r.json().get("update", []):
                        rooms.append({
                            "id": sub.get("rid"),
                            "name": sub.get("name") or sub.get("fname") or "",
                            "type": sub.get("t"),  # c=channel, p=private, d=dm
                            "display_name": sub.get("fname") or sub.get("name") or "",
                            "unread": sub.get("unread", 0),
                            "last_message": sub.get("lastMessage"),
                            "alert": sub.get("alert", False),
                        })
        except Exception as e:
            logger.error(f"[RocketChat Proxy] proxy_get_rooms: {e}")

        return rooms

    async def proxy_get_messages(
        self,
        db: Session,
        rc_user_id: str,
        rc_token: str,
        room_id: str,
        room_type: str,
        count: int = 50,
        offset: int = 0,
    ) -> dict:
        """История сообщений комнаты. room_type: c/channels, p/groups, d/im."""
        base_url = self._get_base_url(db)
        if not base_url:
            return {"messages": [], "total": 0}

        headers = self._get_user_headers(rc_user_id, rc_token)

        endpoint_map = {
            "c": "channels.history",
            "channels": "channels.history",
            "p": "groups.history",
            "groups": "groups.history",
            "d": "im.history",
            "im": "im.history",
        }
        endpoint = endpoint_map.get(room_type, "channels.history")

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.get(
                    f"{base_url}/api/v1/{endpoint}",
                    headers=headers,
                    params={"roomId": room_id, "count": count, "offset": offset},
                )
                if r.status_code == 200 and r.json().get("success"):
                    data = r.json()
                    messages = []
                    for m in data.get("messages", []):
                        messages.append({
                            "id": m.get("_id"),
                            "room_id": room_id,
                            "text": m.get("msg", ""),
                            "sender_name": m.get("u", {}).get("name", ""),
                            "sender_username": m.get("u", {}).get("username", ""),
                            "ts": m.get("ts"),
                            "attachments": m.get("attachments", []),
                            "t": m.get("t"),  # системный тип сообщения
                        })
                    return {"messages": messages, "total": data.get("total", len(messages))}
        except Exception as e:
            logger.error(f"[RocketChat Proxy] proxy_get_messages: {e}")

        return {"messages": [], "total": 0}

    async def proxy_send_message(
        self,
        db: Session,
        rc_user_id: str,
        rc_token: str,
        room_id: str,
        text: str,
    ) -> Optional[dict]:
        """Отправить сообщение от имени пользователя."""
        base_url = self._get_base_url(db)
        if not base_url:
            return None

        headers = self._get_user_headers(rc_user_id, rc_token)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(
                    f"{base_url}/api/v1/chat.sendMessage",
                    headers=headers,
                    json={"message": {"rid": room_id, "msg": text}},
                )
                if r.status_code == 200 and r.json().get("success"):
                    m = r.json().get("message", {})
                    return {
                        "id": m.get("_id"),
                        "room_id": room_id,
                        "text": m.get("msg", ""),
                        "sender_name": m.get("u", {}).get("name", ""),
                        "sender_username": m.get("u", {}).get("username", ""),
                        "ts": m.get("ts"),
                        "attachments": [],
                    }
        except Exception as e:
            logger.error(f"[RocketChat Proxy] proxy_send_message: {e}")
        return None

    async def proxy_get_subscriptions(
        self, db: Session, rc_user_id: str, rc_token: str
    ) -> list:
        """Список подписок с unread counts."""
        base_url = self._get_base_url(db)
        if not base_url:
            return []

        headers = self._get_user_headers(rc_user_id, rc_token)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    f"{base_url}/api/v1/subscriptions.get",
                    headers=headers,
                )
                if r.status_code == 200 and r.json().get("success"):
                    result = []
                    for sub in r.json().get("update", []):
                        result.append({
                            "room_id": sub.get("rid"),
                            "unread": sub.get("unread", 0),
                            "alert": sub.get("alert", False),
                        })
                    return result
        except Exception as e:
            logger.error(f"[RocketChat Proxy] proxy_get_subscriptions: {e}")
        return []

    async def proxy_mark_read(
        self, db: Session, rc_user_id: str, rc_token: str, room_id: str
    ) -> bool:
        """Отметить комнату как прочитанную."""
        base_url = self._get_base_url(db)
        if not base_url:
            return False

        headers = self._get_user_headers(rc_user_id, rc_token)
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.post(
                    f"{base_url}/api/v1/subscriptions.read",
                    headers=headers,
                    json={"rid": room_id},
                )
                return r.status_code == 200 and r.json().get("success", False)
        except Exception as e:
            logger.error(f"[RocketChat Proxy] proxy_mark_read: {e}")
        return False


# Singleton instance
rocketchat_service = RocketChatService()
