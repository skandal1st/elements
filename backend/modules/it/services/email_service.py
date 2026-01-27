"""
Email Service
Отправка и получение email-уведомлений через SMTP/IMAP
"""

import asyncio
import email
import email.utils
import imaplib
import os
import re
import smtplib
import uuid
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from backend.modules.hr.models.system_settings import SystemSettings
from backend.modules.hr.models.user import User


class EmailService:
    """Сервис для работы с email уведомлениями"""

    # --- Helpers для получения настроек ---

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

    def _get_smtp_config(self, db: Session) -> dict:
        """Получить SMTP конфигурацию"""
        # Используем те же ключи что и в настройках фронтенда
        from_email = (
            self._get_setting(db, "smtp_from_email")
            or self._get_setting(db, "email_from")
            or ""
        )
        from_name = (
            self._get_setting(db, "smtp_from_name")
            or self._get_setting(db, "email_from_name")
            or "Elements IT"
        )

        return {
            "host": self._get_setting(db, "smtp_host") or "",
            "port": int(self._get_setting(db, "smtp_port") or "587"),
            "user": self._get_setting(db, "smtp_user") or "",
            "password": self._get_setting(db, "smtp_password") or "",
            "use_tls": (self._get_setting(db, "smtp_use_tls") or "true").lower()
            == "true",
            "from_email": from_email,
            "from_name": from_name,
        }

    def _get_imap_config(self, db: Session) -> dict:
        """Получить IMAP конфигурацию"""
        return {
            "host": self._get_setting(db, "imap_host") or "",
            "port": int(self._get_setting(db, "imap_port") or "993"),
            "user": self._get_setting(db, "imap_user") or "",
            "password": self._get_setting(db, "imap_password") or "",
            "use_ssl": (self._get_setting(db, "imap_use_ssl") or "true").lower()
            == "true",
        }

    # --- SMTP Отправка ---

    def _create_smtp_connection(self, config: dict) -> smtplib.SMTP:
        """Создать SMTP подключение"""
        if config["use_tls"]:
            smtp = smtplib.SMTP(config["host"], config["port"], timeout=30)
            smtp.starttls()
        else:
            smtp = smtplib.SMTP_SSL(config["host"], config["port"], timeout=30)

        if config["user"] and config["password"]:
            smtp.login(config["user"], config["password"])

        return smtp

    def _generate_message_id(self, ticket_id: str, suffix: str = "") -> str:
        """Генерация уникального Message-ID"""
        timestamp = int(datetime.utcnow().timestamp() * 1000)
        random_part = uuid.uuid4().hex[:8]
        suffix_part = f"-{suffix}" if suffix else ""
        domain = "elements.local"
        return (
            f"<ticket-{ticket_id[:8]}-{timestamp}-{random_part}{suffix_part}@{domain}>"
        )

    async def send_email(
        self,
        db: Session,
        to_email: str,
        subject: str,
        html_content: str,
        message_id: Optional[str] = None,
        in_reply_to: Optional[str] = None,
        references: Optional[List[str]] = None,
    ) -> bool:
        """Отправить email (bool без деталей)."""
        ok, err = await self.send_email_detailed(
            db=db,
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            message_id=message_id,
            in_reply_to=in_reply_to,
            references=references,
        )
        if not ok and err:
            print(f"[Email] Ошибка отправки: {err}")
        return ok

    async def send_email_detailed(
        self,
        db: Session,
        to_email: str,
        subject: str,
        html_content: str,
        message_id: Optional[str] = None,
        in_reply_to: Optional[str] = None,
        references: Optional[List[str]] = None,
    ) -> Tuple[bool, Optional[str]]:
        """Отправить email и вернуть (ok, error_message)."""
        if not self._is_enabled(db):
            return False, "Email интеграция отключена (email_enabled=false)"

        config = self._get_smtp_config(db)
        if not config["host"]:
            return False, "SMTP не настроен: отсутствует smtp_host"
        if not config["from_email"]:
            return False, "SMTP не настроен: отсутствует smtp_from_email"
        if config["port"] == 587 and not config["use_tls"]:
            return (
                False,
                "Некорректная настройка SMTP: порт 587 обычно требует STARTTLS (smtp_use_tls=true). "
                "Если используете SSL, укажите порт 465 и smtp_use_tls=false.",
            )

        try:
            msg = MIMEMultipart("alternative")
            msg["From"] = f"{config['from_name']} <{config['from_email']}>"
            msg["To"] = to_email
            msg["Subject"] = subject
            msg["Date"] = email.utils.formatdate(localtime=True)

            if message_id:
                msg["Message-ID"] = message_id
            else:
                msg["Message-ID"] = self._generate_message_id(uuid.uuid4().hex)

            if in_reply_to:
                msg["In-Reply-To"] = in_reply_to

            if references:
                msg["References"] = " ".join(references)

            msg.attach(MIMEText(html_content, "html", "utf-8"))

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._send_email_sync, config, msg, to_email)
            return True, None
        except Exception as e:
            return False, f"{type(e).__name__}: {e}"

    def _send_email_sync(self, config: dict, msg: MIMEMultipart, to_email: str):
        """Синхронная отправка email"""
        smtp = self._create_smtp_connection(config)
        try:
            smtp.sendmail(config["from_email"], [to_email], msg.as_string())
        finally:
            smtp.quit()

    async def check_connection(self, db: Session) -> Tuple[bool, Optional[str]]:
        """Проверить SMTP подключение"""
        config = self._get_smtp_config(db)
        if not config["host"]:
            return False, "SMTP хост не настроен"

        try:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, self._check_smtp_sync, config)
            return True, None
        except Exception as e:
            return False, str(e)

    def _check_smtp_sync(self, config: dict):
        """Синхронная проверка SMTP"""
        smtp = self._create_smtp_connection(config)
        smtp.quit()

    # --- Email Templates ---

    def _escape_html(self, text: str) -> str:
        """Экранирование HTML"""
        return (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace('"', "&quot;")
            .replace("'", "&#039;")
        )

    def _get_status_email_template(
        self,
        status: str,
        ticket_id: str,
        ticket_title: str,
        assignee_name: Optional[str] = None,
    ) -> Tuple[str, str]:
        """Получить тему и HTML шаблон письма о статусе"""
        short_id = ticket_id[:8]

        status_info = {
            "in_progress": {
                "subject": f"Заявка #{short_id} принята в работу",
                "message": "Ваша заявка принята в работу",
                "text": "Наш специалист уже работает над решением вашей проблемы.",
                "color": "#f59e0b",
                "label": "В работе",
            },
            "resolved": {
                "subject": f"Заявка #{short_id} решена",
                "message": "Ваша заявка решена",
                "text": "Ваша проблема была успешно решена. Если у вас остались вопросы, пожалуйста, сообщите нам.",
                "color": "#10b981",
                "label": "Решена",
            },
            "closed": {
                "subject": f"Заявка #{short_id} закрыта",
                "message": "Ваша заявка закрыта",
                "text": "Для просмотра деталей заявки, пожалуйста, войдите в систему.",
                "color": "#6b7280",
                "label": "Закрыта",
            },
        }

        info = status_info.get(
            status,
            {
                "subject": f"Обновление статуса заявки #{short_id}",
                "message": "Статус вашей заявки изменен",
                "text": "Для просмотра деталей заявки, пожалуйста, войдите в систему.",
                "color": "#3b82f6",
                "label": status,
            },
        )

        assignee_row = ""
        if assignee_name:
            assignee_row = f"""
      <tr>
        <td style="padding: 10px 0;">
          <strong style="color: #6b7280; font-size: 14px;">Исполнитель:</strong>
        </td>
        <td style="padding: 10px 0; text-align: right;">
          <span style="font-size: 14px;">{self._escape_html(assignee_name)}</span>
        </td>
      </tr>
            """

        html = f"""
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{info["subject"]}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">

  <div style="background-color: {info["color"]}; color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">{info["message"]}</h1>
  </div>

  <div style="background-color: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <strong style="color: #6b7280; font-size: 14px;">Номер заявки:</strong>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
          <span style="font-family: monospace; background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 14px;">#{short_id}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <strong style="color: #6b7280; font-size: 14px;">Название:</strong>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
          <span style="font-size: 14px;">{self._escape_html(ticket_title)}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <strong style="color: #6b7280; font-size: 14px;">Статус:</strong>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
          <span style="background-color: {info["color"]}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500;">{info["label"]}</span>
        </td>
      </tr>
      {assignee_row}
    </table>

    <div style="margin-top: 30px; padding: 20px; background-color: #f9fafb; border-radius: 6px; border-left: 4px solid {info["color"]};">
      <p style="margin: 0; font-size: 14px; color: #4b5563;">
        {info["text"]}
      </p>
    </div>
  </div>

  <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <div style="padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 15px;">
      <p style="margin: 0; font-size: 13px; color: #92400e;">
        <strong>Важно:</strong> Это автоматическое уведомление. Пожалуйста, не отвечайте на это письмо.
      </p>
    </div>
    <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
      © {datetime.now().year} Elements IT. Система управления IT-заявками.
    </p>
  </div>

</body>
</html>
        """

        return info["subject"], html

    def _get_reply_email_template(
        self,
        ticket_id: str,
        ticket_subject: str,
        reply_content: str,
        sender_name: str,
    ) -> Tuple[str, str]:
        """Получить тему и HTML шаблон для ответа"""
        short_id = ticket_id[:8]
        subject = f"Re: [Ticket #{short_id}] {ticket_subject}"

        html = f"""
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ответ по заявке #{short_id}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">

  <div style="background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 18px; font-weight: 600;">
      Ответ по заявке #{short_id}
    </h1>
    <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">{self._escape_html(ticket_subject)}</p>
  </div>

  <div style="background-color: #ffffff; padding: 25px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #f3f4f6;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">
        <strong style="color: #111827;">{self._escape_html(sender_name)}</strong> ответил на вашу заявку:
      </p>
    </div>

    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; font-size: 14px; color: #374151; white-space: pre-wrap;">{self._escape_html(reply_content)}</p>
    </div>

    <div style="margin-top: 25px; padding: 15px; background-color: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #065f46;">
        <strong>Вы можете ответить на это письмо</strong>, и ваш ответ будет добавлен к заявке.
      </p>
    </div>
  </div>

  <div style="background-color: #ffffff; padding: 15px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
      © {datetime.now().year} Elements IT. Система управления IT-заявками.
    </p>
  </div>

</body>
</html>
        """

        return subject, html

    # --- Notification Methods ---

    async def send_ticket_status_notification(
        self,
        db: Session,
        user_id,
        ticket_id: str,
        ticket_title: str,
        new_status: str,
        assignee_name: Optional[str] = None,
    ) -> bool:
        """Отправить уведомление об изменении статуса заявки"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.email:
            return False

        # Проверяем настройки email уведомлений пользователя
        if hasattr(user, "email_notifications") and not user.email_notifications:
            return False

        subject, html = self._get_status_email_template(
            new_status, ticket_id, ticket_title, assignee_name
        )

        # Пытаемся отправить с threading заголовками, чтобы ответы цеплялись в тикет
        message_id = self._generate_message_id(ticket_id, f"status-{new_status}")
        return await self.send_email(
            db,
            user.email,
            subject,
            html,
            message_id=message_id,
        )

    async def send_ticket_status_notification_to_email(
        self,
        db: Session,
        to_email: str,
        ticket_id: str,
        ticket_title: str,
        new_status: str,
        assignee_name: Optional[str] = None,
        in_reply_to: Optional[str] = None,
        references: Optional[List[str]] = None,
    ) -> Optional[str]:
        """
        Отправить уведомление об изменении статуса на произвольный email
        (для email-тикетов без зарегистрированного пользователя).

        Возвращает Message-ID отправленного письма (или None при ошибке).
        """
        if not to_email:
            return None

        subject, html = self._get_status_email_template(
            new_status, ticket_id, ticket_title, assignee_name
        )
        message_id = self._generate_message_id(ticket_id, f"status-{new_status}")

        refs = None
        if references or in_reply_to:
            refs = (references or []) + ([in_reply_to] if in_reply_to else [])

        ok = await self.send_email(
            db,
            to_email,
            subject,
            html,
            message_id=message_id,
            in_reply_to=in_reply_to,
            references=refs,
        )
        return message_id if ok else None

    async def send_ticket_reply(
        self,
        db: Session,
        to_email: str,
        ticket_id: str,
        ticket_subject: str,
        reply_content: str,
        sender_name: str,
        in_reply_to: Optional[str] = None,
        references: Optional[List[str]] = None,
    ) -> Optional[str]:
        """Отправить email-ответ на тикет"""
        message_id = self._generate_message_id(ticket_id, "reply")
        subject, html = self._get_reply_email_template(
            ticket_id, ticket_subject, reply_content, sender_name
        )

        refs = None
        if references or in_reply_to:
            refs = (references or []) + ([in_reply_to] if in_reply_to else [])

        success = await self.send_email(
            db,
            to_email,
            subject,
            html,
            message_id=message_id,
            in_reply_to=in_reply_to,
            references=refs,
        )

        return message_id if success else None

    async def send_ticket_reply_detailed(
        self,
        db: Session,
        to_email: str,
        ticket_id: str,
        ticket_subject: str,
        reply_content: str,
        sender_name: str,
        in_reply_to: Optional[str] = None,
        references: Optional[List[str]] = None,
    ) -> Tuple[Optional[str], Optional[str]]:
        """Отправить email-ответ на тикет и вернуть (message_id, error_message)."""
        message_id = self._generate_message_id(ticket_id, "reply")
        subject, html = self._get_reply_email_template(
            ticket_id, ticket_subject, reply_content, sender_name
        )

        refs = None
        if references or in_reply_to:
            refs = (references or []) + ([in_reply_to] if in_reply_to else [])

        ok, err = await self.send_email_detailed(
            db=db,
            to_email=to_email,
            subject=subject,
            html_content=html,
            message_id=message_id,
            in_reply_to=in_reply_to,
            references=refs,
        )
        return (message_id if ok else None), err

    def _get_equipment_request_status_template(
        self,
        status: str,
        request_id: str,
        title: str,
    ) -> Tuple[str, str]:
        """Тема и HTML для уведомления по заявке на оборудование."""
        short_id = request_id[:8]
        labels = {
            "pending": ("На рассмотрении", "#6b7280"),
            "approved": ("Одобрена", "#10b981"),
            "rejected": ("Отклонена", "#ef4444"),
            "ordered": ("Заказана", "#f59e0b"),
            "received": ("Получена", "#8b5cf6"),
            "issued": ("Выдана", "#3b82f6"),
            "cancelled": ("Отменена", "#6b7280"),
        }
        label, color = labels.get(status, (status, "#3b82f6"))
        subject = f"Статус заявки на оборудование #{short_id}: {label}"

        html = f"""
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
  <div style="background-color: {color}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 18px; font-weight: 600;">Заявка на оборудование: {label}</h1>
  </div>
  <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="margin: 0 0 12px 0; font-size: 14px;">
      Заявка <strong>#{short_id}</strong>: {self._escape_html(title)}
    </p>
    <p style="margin: 0; font-size: 12px; color: #6b7280;">
      Это автоматическое уведомление.
    </p>
  </div>
</body>
</html>
        """
        return subject, html

    async def send_equipment_request_status_notification(
        self,
        db: Session,
        to_email: str,
        request_id: str,
        title: str,
        new_status: str,
    ) -> Tuple[bool, Optional[str]]:
        """Уведомление по заявке на оборудование (ok, error_message)."""
        if not to_email:
            return False, "У заявки нет email получателя"
        subject, html = self._get_equipment_request_status_template(
            new_status, request_id, title
        )
        message_id = self._generate_message_id(request_id, f"equip-{new_status}")
        return await self.send_email_detailed(
            db=db,
            to_email=to_email,
            subject=subject,
            html_content=html,
            message_id=message_id,
        )

    async def notify_new_ticket(
        self,
        db: Session,
        ticket_id: str,
        ticket_title: str,
    ) -> int:
        """Уведомить IT-специалистов о новой заявке по email"""
        if not self._is_enabled(db):
            return 0

        # Получаем всех IT-специалистов с email уведомлениями
        users = db.query(User).filter(User.email.isnot(None)).all()

        it_users = []
        for user in users:
            roles = user.roles or {}
            it_role = roles.get("it", "employee")
            if it_role in ["admin", "it_specialist"] or user.is_superuser:
                # Проверяем настройки уведомлений
                if not hasattr(user, "email_notifications") or user.email_notifications:
                    it_users.append(user)

        short_id = ticket_id[:8]
        subject = f"Новая заявка #{short_id}"

        html = f"""
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Новая заявка</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">

  <div style="background-color: #3b82f6; color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Новая заявка</h1>
  </div>

  <div style="background-color: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="margin: 0 0 20px 0; font-size: 14px;">
      Поступила новая заявка: <strong>{self._escape_html(ticket_title)}</strong>
    </p>
    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
      Номер заявки: #{short_id}
    </p>
  </div>

</body>
</html>
        """

        success_count = 0
        for user in it_users:
            if await self.send_email(db, user.email, subject, html):
                success_count += 1

        return success_count


# Singleton instance
email_service = EmailService()
