"""
Миграция: сделать поля IMAP/SMTP в mail_accounts опциональными.
Серверные настройки задаются в Настройках → Интеграция с почтовым сервером;
пользователь вводит только логин и пароль в разделе Почта.

Запуск: из корня проекта:
  python -m backend.scripts.migrate_mail_accounts_nullable_server
"""
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from sqlalchemy import text
from backend.core.database import engine


def run():
    with engine.begin() as conn:
        for col in ("imap_host", "imap_port", "imap_ssl", "smtp_host", "smtp_port", "smtp_ssl"):
            try:
                conn.execute(text(
                    f"ALTER TABLE mail_accounts ALTER COLUMN {col} DROP NOT NULL"
                ))
                print(f"  mail_accounts.{col} -> nullable")
            except Exception as e:
                print(f"  mail_accounts.{col}: {e}")
                raise
    print("Done.")


if __name__ == "__main__":
    run()
