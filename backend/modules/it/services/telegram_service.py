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
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User
from backend.modules.it.models import Ticket

logger = logging.getLogger(__name__)


class TelegramService:
    """Сервис для работы с Telegram Bot API"""

    def __init__(self):
        self._polling_task: Optional[asyncio.Task] = None
        self._polling_active = False

    # ── helpers ──────────────────────────────────────────────

    def _get_setting(self, db: Session, key: str) -> Optional[str]:
        setting = (
            db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
        )
        return setting.setting_value if setting else None

    def _get_bot_token(self, db: Session) -> Optional[str]:
        """Получить токен бота из БД"""
        return self._get_setting(db, "telegram_bot_token")

    def _is_enabled(self, db: Session) -> bool:
        """Проверить включена ли интеграция"""
        value = self._get_setting(db, "telegram_bot_enabled")
        return bool(value and value.lower() == "true")

    def _get_bot_username(self, db: Session) -> Optional[str]:
        """Получить username бота"""
        return self._get_setting(db, "telegram_bot_username")

    def _get_public_app_url(self, db: Session) -> Optional[str]:
        """
        Публичный URL системы (нужен для кнопок url в Telegram).
        Берём из public_app_url, иначе пытаемся вывести из telegram_webhook_url.
        """
        raw = (self._get_setting(db, "public_app_url") or "").strip()
        if raw:
            return raw.rstrip("/")

        webhook = (self._get_setting(db, "telegram_webhook_url") or "").strip()
        if webhook.startswith("http://") or webhook.startswith("https://"):
            # https://host/path -> https://host
            try:
                # без лишних зависимостей: грубо отрежем путь
                parts = webhook.split("/")
                if len(parts) >= 3:
                    return f"{parts[0]}//{parts[2]}".rstrip("/")
            except Exception:
                pass

        return None

    def _ticket_url(self, db: Session, ticket_id: UUID) -> Optional[str]:
        base = self._get_public_app_url(db)
        if not base:
            return None
        return f"{base}/it/tickets?open={ticket_id}"

    def _format_ticket_details(self, t: Ticket) -> str:
        short_id = str(t.id)[:8]
        status_labels = {
            "new": "Новая",
            "in_progress": "В работе",
            "waiting": "Ожидание",
            "resolved": "Решена",
            "closed": "Закрыта",
            "pending_user": "Ожидает привязки",
        }
        prio_labels = {
            "low": "Низкий",
            "medium": "Средний",
            "high": "Высокий",
            "critical": "Критический",
        }
        cat_labels = {
            "hardware": "Оборудование",
            "software": "ПО",
            "network": "Сеть",
            "hr": "HR",
            "other": "Прочее",
        }
        src_labels = {"web": "Веб", "email": "Email", "api": "API", "telegram": "Telegram"}

        status = status_labels.get(t.status, t.status)
        priority = prio_labels.get(t.priority, t.priority)
        category = cat_labels.get(t.category, t.category)
        source = src_labels.get(t.source, t.source)

        assignee = None
        try:
            if t.assignee:
                assignee = t.assignee.full_name
        except Exception:
            assignee = None

        employee_name = None
        try:
            if t.employee:
                employee_name = t.employee.full_name
        except Exception:
            employee_name = None

        lines = [
            f"*Заявка #{short_id}*",
            f"*Статус:* {status}",
            f"*Приоритет:* {priority}",
            f"*Категория:* {category}",
            f"*Источник:* {source}",
        ]
        if employee_name:
            lines.append(f"*Сотрудник:* {employee_name}")
        if t.email_sender:
            lines.append(f"*Email отправителя:* {t.email_sender}")
        if assignee:
            lines.append(f"*Исполнитель:* {assignee}")
        lines.append("")
        lines.append(f"*Тема:* {t.title}")
        lines.append("")
        # Ограничим размер текста (Telegram лимит на сообщение)
        desc = (t.description or "").strip()
        if len(desc) > 1200:
            desc = desc[:1200] + "…"
        if desc:
            lines.append(f"*Описание:*\n{desc}")
        return "\n".join(lines)

    def _user_by_telegram_chat(self, db: Session, chat_id: int) -> Optional[User]:
        return db.query(User).filter(User.telegram_id == chat_id).first()

    def _is_it_user(self, user: User) -> bool:
        if user.is_superuser:
            return True
        roles = user.roles or {}
        return roles.get("it") in ("admin", "it_specialist")

    async def _send_main_menu(self, db: Session, chat_id: int) -> None:
        reply_markup = {
            "inline_keyboard": [
                [{"text": "📌 Все активные тикеты", "callback_data": "tickets_active_0"}]
            ]
        }
        await self.send_message(
            db,
            chat_id,
            "Меню:\n\n- «Все активные тикеты» — список незакрытых заявок.",
            reply_markup=reply_markup,
        )

    async def _send_active_tickets(
        self, db: Session, chat_id: int, user: User, page: int = 0, page_size: int = 5
    ) -> None:
        page = max(0, int(page))
        offset = page * page_size

        q = db.query(Ticket).filter(Ticket.status.notin_(["closed", "resolved"]))
        if not self._is_it_user(user):
            q = q.filter(Ticket.creator_id == user.id)

        tickets = q.order_by(Ticket.created_at.desc()).offset(offset).limit(page_size + 1).all()
        has_next = len(tickets) > page_size
        tickets = tickets[:page_size]

        if not tickets:
            await self.send_message(db, chat_id, "Активных тикетов не найдено.")
            return

        lines = []
        keyboard_rows = []
        for t in tickets:
            short_id = str(t.id)[:8]
            lines.append(f"• #{short_id} [{t.status}] {t.title}")

            url = self._ticket_url(db, t.id)
            if url:
                keyboard_rows.append([{"text": f"📋 Открыть #{short_id}", "url": url}])
            else:
                keyboard_rows.append([{"text": f"📋 Открыть #{short_id}", "callback_data": f"ticket_view_{t.id}"}])

            keyboard_rows.append([{"text": "➕ Добавить задачу", "callback_data": f"ticket_task_{t.id}"}])

        nav = []
        if page > 0:
            nav.append({"text": "⬅️ Назад", "callback_data": f"tickets_active_{page-1}"})
        if has_next:
            nav.append({"text": "Вперёд ➡️", "callback_data": f"tickets_active_{page+1}"})
        if nav:
            keyboard_rows.append(nav)

        await self.send_message(
            db,
            chat_id,
            "Активные тикеты:\n\n" + "\n".join(lines),
            reply_markup={"inline_keyboard": keyboard_rows},
        )

    def _create_task_from_ticket(self, db: Session, user: User, ticket: Ticket) -> str:
        from backend.modules.tasks.models import Project, Task

        # Защита от дублей: несколько одновременных нажатий в Telegram могут
        # создать несколько "Личных задач". На Postgres используем advisory-lock
        # на время транзакции (ключ детерминированный по user.id).
        try:
            lock_key = int(user.id.int % 9223372036854775807)
            db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": lock_key})
        except Exception:
            # Не Postgres / нет прав / другая БД — просто пропустим
            pass

        # Предпочитаем проект "Личные задачи" (создаётся ботом), иначе берём
        # первый личный проект пользователя.
        project = (
            db.query(Project)
            .filter(
                Project.owner_id == user.id,
                Project.is_personal == True,
                Project.is_archived == False,
                Project.title == "Личные задачи",
            )
            .order_by(Project.created_at.asc())
            .first()
        )
        if not project:
            project = (
                db.query(Project)
                .filter(
                    Project.owner_id == user.id,
                    Project.is_personal == True,
                    Project.is_archived == False,
                )
                .order_by(Project.created_at.asc())
                .first()
            )
        if not project:
            project = Project(
                owner_id=user.id,
                title="Личные задачи",
                description="Автоматически создано для задач из Telegram",
                is_personal=True,
            )
            db.add(project)
            db.flush()

        task = Task(
            project_id=project.id,
            title=f"Заявка: {ticket.title}",
            description=f"Создано из Telegram по заявке #{str(ticket.id)[:8]}",
            status="todo",
            priority="medium",
            creator_id=user.id,
            assignee_id=user.id,
            linked_ticket_id=ticket.id,
        )
        db.add(task)
        db.commit()
        return str(task.id)


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

    def generate_unique_link_code(self, db: Session, attempts: int = 30) -> str:
        """
        Сгенерировать код привязки, минимизируя коллизии.

        Причина: код короткий (6 цифр) и при одновременной привязке несколькими
        сотрудниками возможны совпадения. Мы гарантируем, что код не занят
        (по крайней мере среди неистёкших кодов) на момент выдачи.
        """
        now = datetime.utcnow()
        for _ in range(attempts):
            code = self.generate_link_code()
            exists = (
                db.query(User.id)
                .filter(
                    User.telegram_link_code == code,
                    User.telegram_link_code_expires > now,
                )
                .first()
            )
            if not exists:
                return code
        # Маловероятно, но чтобы не отдавать потенциально конфликтный код
        raise RuntimeError("Не удалось сгенерировать уникальный код привязки")

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
                        try:
                            db.commit()
                        except IntegrityError:
                            # Обычно это означает, что telegram_id уже привязан к другому пользователю
                            db.rollback()
                            await self.send_message(
                                db,
                                chat_id,
                                "Не удалось привязать аккаунт: этот Telegram уже привязан к другой учётной записи.\n"
                                "Если это ваш аккаунт — сначала отвяжите его в профиле и попробуйте снова.",
                            )
                            return

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
                    if chat_id:
                        await self._send_main_menu(db, chat_id)
            elif text.strip() in ("/menu", "меню", "Menu", "MENU"):
                if chat_id:
                    await self._send_main_menu(db, chat_id)
            elif text.strip() in ("/tickets", "тикеты", "активные тикеты"):
                if not chat_id:
                    return
                u = self._user_by_telegram_chat(db, chat_id)
                if not u:
                    await self.send_message(
                        db,
                        chat_id,
                        "Аккаунт не привязан. Откройте IT → Telegram и выполните привязку.",
                    )
                    return
                await self._send_active_tickets(db, chat_id, u, page=0)

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

            data = (callback_query.get("data") or "").strip()
            msg = callback_query.get("message") or {}
            chat_id = (msg.get("chat") or {}).get("id")
            if not chat_id:
                return

            user = self._user_by_telegram_chat(db, chat_id)
            if not user:
                await self.send_message(
                    db,
                    chat_id,
                    "Аккаунт не привязан. Откройте IT → Telegram и выполните привязку.",
                )
                return

            # Открыть заявку (fallback для старых callback-кнопок)
            if data.startswith("ticket_view_"):
                raw_id = data.replace("ticket_view_", "", 1)
                try:
                    ticket_id = UUID(raw_id)
                except Exception:
                    await self.send_message(db, chat_id, "Некорректный ID заявки.")
                    return

                url = self._ticket_url(db, ticket_id)
                if url:
                    await self.send_message(
                        db,
                        chat_id,
                        "Открыть заявку:",
                        reply_markup={
                            "inline_keyboard": [[{"text": "📋 Открыть заявку", "url": url}]]
                        },
                    )
                else:
                    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
                    if not ticket:
                        await self.send_message(db, chat_id, "Заявка не найдена.")
                        return

                    # Права: сотрудник видит только свои тикеты
                    if not self._is_it_user(user) and ticket.creator_id != user.id:
                        await self.send_message(db, chat_id, "Недостаточно прав для просмотра этой заявки.")
                        return

                    text = self._format_ticket_details(ticket)
                    await self.send_message(
                        db,
                        chat_id,
                        text,
                        reply_markup={
                            "inline_keyboard": [
                                [{"text": "➕ Добавить задачу", "callback_data": f"ticket_task_{ticket_id}"}],
                                [{"text": "📌 Все активные тикеты", "callback_data": "tickets_active_0"}],
                            ]
                        },
                    )
                return

            # Все активные тикеты
            if data.startswith("tickets_active_"):
                raw_page = data.replace("tickets_active_", "", 1)
                try:
                    page = int(raw_page)
                except Exception:
                    page = 0
                await self._send_active_tickets(db, chat_id, user, page=page)
                return

            # Добавить задачу по тикету
            if data.startswith("ticket_task_"):
                raw_id = data.replace("ticket_task_", "", 1)
                try:
                    ticket_id = UUID(raw_id)
                except Exception:
                    await self.send_message(db, chat_id, "Некорректный ID заявки.")
                    return

                ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
                if not ticket:
                    await self.send_message(db, chat_id, "Заявка не найдена.")
                    return

                # Права: сотрудник может создавать задачу только по своим тикетам
                if not self._is_it_user(user) and ticket.creator_id != user.id:
                    await self.send_message(db, chat_id, "Недостаточно прав для этой операции.")
                    return

                try:
                    self._create_task_from_ticket(db, user, ticket)
                except Exception as e:
                    await self.send_message(db, chat_id, f"Не удалось создать задачу: {type(e).__name__}: {e}")
                    return

                base = self._get_public_app_url(db)
                reply_markup = None
                if base:
                    reply_markup = {
                        "inline_keyboard": [
                            [{"text": "🗂 Открыть «Мои задачи»", "url": f"{base}/tasks/my"}]
                        ]
                    }
                await self.send_message(
                    db,
                    chat_id,
                    "Задача создана в модуле Tasks.",
                    reply_markup=reply_markup,
                )
                return

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
            url = self._ticket_url(db, ticket_id)
            if url:
                reply_markup = {
                    "inline_keyboard": [
                        [{"text": "📋 Открыть заявку", "url": url}],
                        [{"text": "➕ Добавить задачу", "callback_data": f"ticket_task_{ticket_id}"}],
                        [{"text": "📌 Все активные тикеты", "callback_data": "tickets_active_0"}],
                    ]
                }
            else:
                reply_markup = {
                    "inline_keyboard": [
                        [{"text": "📋 Открыть заявку", "callback_data": f"ticket_view_{ticket_id}"}],
                        [{"text": "➕ Добавить задачу", "callback_data": f"ticket_task_{ticket_id}"}],
                        [{"text": "📌 Все активные тикеты", "callback_data": "tickets_active_0"}],
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
        source: str = "web",  # NEW: источник заявки
    ) -> int:
        """Уведомить IT-специалистов о новой заявке

        Для внешних источников (email, rocketchat): уведомляет всех IT-специалистов
        Для внутренних источников (web, telegram): уведомления отправляются только при назначении
        """
        if not self._is_enabled(db):
            return 0

        # Для внутренних источников уведомления отправляются только через notify_ticket_assigned
        if source not in ["email", "rocketchat"]:
            return 0

        # Получаем всех IT-специалистов с Telegram
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

        text = f'*🆕 Новая заявка*\n\nПоступила новая заявка: "{ticket_title}"\nИсточник: {source}'
        url = self._ticket_url(db, ticket_id)
        if url:
            reply_markup = {
                "inline_keyboard": [
                    [{"text": "📋 Открыть заявку", "url": url}],
                    [{"text": "➕ Добавить задачу", "callback_data": f"ticket_task_{ticket_id}"}],
                    [{"text": "📌 Все активные тикеты", "callback_data": "tickets_active_0"}],
                ]
            }
        else:
            reply_markup = {
                "inline_keyboard": [
                    [{"text": "📋 Открыть заявку", "callback_data": f"ticket_view_{ticket_id}"}],
                    [{"text": "➕ Добавить задачу", "callback_data": f"ticket_task_{ticket_id}"}],
                    [{"text": "📌 Все активные тикеты", "callback_data": "tickets_active_0"}],
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

    def get_it_specialists(self, db: Session) -> List[User]:
        """Получить всех IT-специалистов и админов"""
        users = db.query(User).all()
        print(f"[Telegram] Всего пользователей в системе: {len(users)}")

        it_users = []
        for user in users:
            roles = user.roles or {}
            it_role = roles.get("it", "employee")
            print(f"[Telegram] Проверка пользователя {user.email}: роль IT={it_role}, суперпользователь={user.is_superuser}")
            if it_role in ["admin", "it_specialist"] or user.is_superuser:
                it_users.append(user)
                print(f"[Telegram] ✅ {user.email} добавлен как IT-специалист")

        print(f"[Telegram] Найдено IT-специалистов: {len(it_users)}")
        return it_users

    def auto_assign_to_it_specialist(self, db: Session, ticket) -> Optional[User]:
        """Автоматически назначить заявку на наименее загруженного IT-специалиста

        Возвращает назначенного специалиста или None если специалистов нет.
        """
        from backend.modules.it.models.ticket import Ticket
        from sqlalchemy import func

        print(f"[Telegram] 🔄 Автораспределение для тикета #{str(ticket.id)[:8]} (source={ticket.source})")

        it_specialists = self.get_it_specialists(db)

        if not it_specialists:
            print("[Telegram] Нет доступных IT-специалистов для автоназначения")
            return None

        # Подсчитываем открытые заявки для каждого специалиста
        workload = {}
        for specialist in it_specialists:
            open_count = (
                db.query(func.count(Ticket.id))
                .filter(
                    Ticket.assignee_id == specialist.id,
                    Ticket.status.in_(["new", "in_progress"])
                )
                .scalar()
            )
            workload[specialist.id] = open_count or 0

        # Выбираем специалиста с минимальной нагрузкой
        least_loaded_id = min(workload, key=workload.get)
        assignee = db.query(User).filter(User.id == least_loaded_id).first()

        if assignee:
            ticket.assignee_id = assignee.id
            db.commit()
            db.refresh(ticket)
            print(f"[Telegram] Заявка #{str(ticket.id)[:8]} назначена на {assignee.email} (нагрузка: {workload[least_loaded_id]})")

        return assignee

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
