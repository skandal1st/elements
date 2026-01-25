"""
Email Receiver Service
Получает письма через IMAP и создает тикеты или комментарии (для ответов)
"""

import email
import imaplib
import os
import re
import uuid
from datetime import datetime
from email.header import decode_header
from pathlib import Path
from typing import Optional

from sqlalchemy.orm import Session

from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User
from backend.modules.it.models import Ticket, TicketComment


# Разрешённые расширения файлов
ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg",  # Изображения
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",  # Документы
    ".txt", ".log", ".csv",  # Текст
    ".zip", ".rar", ".7z", ".tar", ".gz",  # Архивы
}

# Директория для загрузок
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads/tickets")


class EmailReceiverService:
    """Сервис для получения email и создания тикетов"""

    def _get_setting(self, db: Session, key: str) -> Optional[str]:
        """Получить настройку из БД"""
        setting = (
            db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
        )
        return setting.setting_value if setting else None

    def _is_enabled(self, db: Session) -> bool:
        """Проверить включена ли интеграция"""
        value = self._get_setting(db, "email_enabled")
        return value and value.lower() == "true"

    def _get_imap_config(self, db: Session) -> dict:
        """Получить IMAP конфигурацию"""
        return {
            "host": self._get_setting(db, "imap_host") or "",
            "port": int(self._get_setting(db, "imap_port") or "993"),
            "user": self._get_setting(db, "imap_user") or "",
            "password": self._get_setting(db, "imap_password") or "",
            "use_ssl": (self._get_setting(db, "imap_use_ssl") or "true").lower() == "true",
        }

    def _decode_header_value(self, value: str) -> str:
        """Декодировать заголовок email"""
        if not value:
            return ""
        decoded_parts = decode_header(value)
        result = []
        for part, charset in decoded_parts:
            if isinstance(part, bytes):
                result.append(part.decode(charset or "utf-8", errors="replace"))
            else:
                result.append(part)
        return "".join(result)

    def _extract_email_address(self, from_header: str) -> str:
        """Извлечь email адрес из заголовка From"""
        match = re.search(r"<([^>]+)>", from_header)
        if match:
            return match.group(1).lower()
        # Если нет угловых скобок, весь заголовок — это email
        return from_header.strip().lower()

    def _parse_category_and_priority(self, subject: str) -> tuple[str, str]:
        """Парсинг категории и приоритета из темы письма"""
        subject_lower = subject.lower()

        # Парсинг категории
        category = "other"
        if re.search(r"\[hardware\]|железо|оборудование|компьютер|принтер|монитор|клавиатура|мышь", subject, re.I):
            category = "hardware"
        elif re.search(r"\[software\]|по|программа|1с|софт|приложение", subject, re.I):
            category = "software"
        elif re.search(r"\[network\]|сеть|интернет|wi-?fi|роутер|свитч", subject, re.I):
            category = "network"

        # Парсинг приоритета
        priority = "medium"
        if re.search(r"\[critical\]|срочно|критично|авария|немедленно", subject, re.I):
            priority = "critical"
        elif re.search(r"\[high\]|важно|высокий", subject, re.I):
            priority = "high"
        elif re.search(r"\[low\]|низкий|несрочно", subject, re.I):
            priority = "low"

        return category, priority

    def _is_allowed_file(self, filename: str) -> bool:
        """Проверка допустимых типов файлов"""
        ext = Path(filename).suffix.lower()
        return ext in ALLOWED_EXTENSIONS

    def _save_attachment(self, filename: str, content: bytes) -> Optional[str]:
        """Сохранить вложение на диск"""
        if not filename or not self._is_allowed_file(filename):
            return None

        # Создаём директорию
        upload_path = Path(UPLOAD_DIR)
        upload_path.mkdir(parents=True, exist_ok=True)

        # Генерируем уникальное имя
        ext = Path(filename).suffix.lower()
        unique_name = f"{uuid.uuid4()}{ext}"
        filepath = upload_path / unique_name

        # Сохраняем файл
        filepath.write_bytes(content)

        return f"/uploads/tickets/{unique_name}"

    def _get_email_body(self, msg) -> str:
        """Извлечь тело письма"""
        body = ""

        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                content_disposition = str(part.get("Content-Disposition", ""))

                # Пропускаем вложения
                if "attachment" in content_disposition:
                    continue

                if content_type == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body = payload.decode(charset, errors="replace")
                        break
                elif content_type == "text/html" and not body:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        html = payload.decode(charset, errors="replace")
                        # Убираем HTML теги
                        body = re.sub(r"<[^>]+>", " ", html)
                        body = re.sub(r"\s+", " ", body).strip()
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                body = payload.decode(charset, errors="replace")

        return body or "Нет содержимого"

    def _get_attachments(self, msg) -> list[str]:
        """Извлечь и сохранить вложения"""
        attachments = []

        if not msg.is_multipart():
            return attachments

        for part in msg.walk():
            content_disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in content_disposition or "inline" in content_disposition:
                filename = part.get_filename()
                if filename:
                    filename = self._decode_header_value(filename)
                    content = part.get_payload(decode=True)
                    if content:
                        saved_path = self._save_attachment(filename, content)
                        if saved_path:
                            attachments.append(saved_path)

        return attachments

    def _find_ticket_by_reply(
        self, db: Session, message_id: Optional[str], in_reply_to: Optional[str],
        references: Optional[list[str]], subject: str
    ) -> Optional[Ticket]:
        """Поиск тикета по email threading headers или теме"""

        # 1. Ищем по In-Reply-To в tickets.email_message_id
        if in_reply_to:
            ticket = db.query(Ticket).filter(Ticket.email_message_id == in_reply_to).first()
            if ticket:
                return ticket

        # 2. Ищем по References
        if references:
            for ref in references:
                ticket = db.query(Ticket).filter(Ticket.email_message_id == ref).first()
                if ticket:
                    return ticket

        # 3. Фоллбэк: парсинг темы Re: [Ticket #xxxxxxxx]
        match = re.search(r"\[Ticket #([a-f0-9]{8})\]", subject, re.I)
        if match:
            short_id = match.group(1)
            # Ищем тикет начинающийся с этого ID
            tickets = db.query(Ticket).all()
            for ticket in tickets:
                if str(ticket.id).startswith(short_id):
                    return ticket

        return None

    def _create_ticket_from_email(
        self, db: Session, from_email: str, subject: str, body: str,
        attachments: list[str], message_id: Optional[str]
    ) -> Ticket:
        """Создать тикет из email"""

        # Проверяем, существует ли пользователь
        user = db.query(User).filter(User.email == from_email).first()

        category, priority = self._parse_category_and_priority(subject)

        # Определяем статус
        if user:
            status = "new"
            creator_id = user.id
            email_sender = None
        else:
            status = "pending_user"  # Требует привязки к пользователю
            creator_id = None
            email_sender = from_email

        ticket = Ticket(
            title=subject or "Без темы",
            description=body,
            category=category,
            priority=priority,
            status=status,
            creator_id=creator_id,
            email_sender=email_sender,
            source="email",
            email_message_id=message_id,
            attachments=attachments if attachments else None,
        )
        db.add(ticket)
        db.flush()

        print(f"[Email Receiver] Тикет создан: #{str(ticket.id)[:8]} (статус: {status})")
        return ticket

    def _create_comment_from_email(
        self, db: Session, ticket: Ticket, from_email: str, body: str,
        attachments: list[str], message_id: Optional[str]
    ) -> TicketComment:
        """Создать комментарий из email-ответа"""

        # Проверяем, существует ли пользователь
        user = db.query(User).filter(User.email == from_email).first()

        if not user:
            # Если пользователь не найден, не можем создать комментарий
            # (ticket_comments требует user_id)
            print(f"[Email Receiver] Пользователь {from_email} не найден, комментарий не создан")
            return None

        comment = TicketComment(
            ticket_id=ticket.id,
            user_id=user.id,
            content=body,
            attachments=attachments if attachments else None,
        )
        db.add(comment)

        # Обновляем updated_at тикета
        ticket.updated_at = datetime.utcnow()

        db.flush()

        print(f"[Email Receiver] Комментарий создан для тикета #{str(ticket.id)[:8]}")
        return comment

    def check_new_emails(self, db: Session) -> dict:
        """Проверить новые письма и создать тикеты/комментарии"""

        if not self._is_enabled(db):
            return {"success": False, "error": "Email интеграция отключена"}

        config = self._get_imap_config(db)
        if not config["host"] or not config["user"] or not config["password"]:
            return {"success": False, "error": "IMAP не настроен"}

        stats = {
            "success": True,
            "emails_processed": 0,
            "tickets_created": 0,
            "comments_created": 0,
            "errors": [],
        }

        try:
            # Подключаемся к IMAP
            if config["use_ssl"]:
                imap = imaplib.IMAP4_SSL(config["host"], config["port"])
            else:
                imap = imaplib.IMAP4(config["host"], config["port"])

            imap.login(config["user"], config["password"])
            imap.select("INBOX")

            # Ищем непрочитанные письма
            status, messages = imap.search(None, "UNSEEN")
            if status != "OK":
                return {"success": False, "error": "Ошибка поиска писем"}

            email_ids = messages[0].split()
            print(f"[Email Receiver] Найдено новых писем: {len(email_ids)}")

            for email_id in email_ids:
                try:
                    # Получаем письмо
                    status, msg_data = imap.fetch(email_id, "(RFC822)")
                    if status != "OK":
                        continue

                    raw_email = msg_data[0][1]
                    msg = email.message_from_bytes(raw_email)

                    # Извлекаем данные
                    from_header = self._decode_header_value(msg.get("From", ""))
                    from_email_addr = self._extract_email_address(from_header)
                    subject = self._decode_header_value(msg.get("Subject", ""))
                    message_id = msg.get("Message-ID")
                    in_reply_to = msg.get("In-Reply-To")
                    references_header = msg.get("References", "")
                    references = references_header.split() if references_header else []

                    body = self._get_email_body(msg)
                    attachments = self._get_attachments(msg)

                    print(f"[Email Receiver] Обработка письма от: {from_email_addr}")

                    # Проверяем, является ли это ответом
                    existing_ticket = self._find_ticket_by_reply(
                        db, message_id, in_reply_to, references, subject
                    )

                    if existing_ticket:
                        if existing_ticket.status == "closed":
                            # Тикет закрыт - создаём новый
                            self._create_ticket_from_email(
                                db, from_email_addr, subject, body, attachments, message_id
                            )
                            stats["tickets_created"] += 1
                        else:
                            # Добавляем комментарий
                            comment = self._create_comment_from_email(
                                db, existing_ticket, from_email_addr, body, attachments, message_id
                            )
                            if comment:
                                stats["comments_created"] += 1
                    else:
                        # Новый тикет
                        self._create_ticket_from_email(
                            db, from_email_addr, subject, body, attachments, message_id
                        )
                        stats["tickets_created"] += 1

                    stats["emails_processed"] += 1

                except Exception as e:
                    stats["errors"].append(str(e))
                    print(f"[Email Receiver] Ошибка обработки письма: {e}")

            db.commit()
            imap.close()
            imap.logout()

        except Exception as e:
            stats["success"] = False
            stats["errors"].append(str(e))
            print(f"[Email Receiver] Ошибка IMAP: {e}")

        return stats


# Singleton instance
email_receiver = EmailReceiverService()
