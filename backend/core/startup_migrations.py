"""
Минимальные безопасные миграции, которые можно применять при старте приложения.

Задача: не ломать запуск при рассинхронизации схемы БД и моделей,
при этом не требовать Alembic.
"""

import logging

from sqlalchemy import text

from backend.core.database import engine


logger = logging.getLogger(__name__)


def _exec_best_effort(sql: str) -> None:
    """
    Выполняет DDL в отдельной транзакции.
    В Postgres ошибка в DDL "ломает" транзакцию, поэтому изоляция обязательна.
    """
    try:
        with engine.begin() as conn:
            conn.execute(text(sql))
    except Exception as e:
        logger.warning("startup migration skipped (%s): %s", sql, e)


def ensure_users_telegram_columns() -> None:
    """
    Добавляет Telegram-поля в таблицу users, если они отсутствуют.

    Это нужно, потому что ORM всегда выбирает все колонки модели User,
    и отсутствие любой из них приводит к 500 даже на /auth/login.
    """
    statements = [
        # Колонки
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_id BIGINT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_notifications BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_code VARCHAR(6)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_code_expires TIMESTAMPTZ",
        # Индекс/уникальность telegram_id (мягко, без падений)
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id_unique ON users(telegram_id)",
    ]

    for sql in statements:
        _exec_best_effort(sql)


def ensure_tickets_columns() -> None:
    """
    Добавляет недостающие колонки в tickets согласно текущей модели Ticket.

    ORM выбирает все атрибуты модели, поэтому отсутствие любой колонки приводит к 500.
    """
    statements = [
        # employee link
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS employee_id INTEGER",
        # location
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS room_id UUID",
        # source/email threading
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'web' NOT NULL",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_sender VARCHAR(255)",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email_message_id VARCHAR(255)",
        # optional fields (safe to add if missing)
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS attachments TEXT[]",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS desired_resolution_date TIMESTAMPTZ",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rating INTEGER",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rating_comment TEXT",
        # indices (best-effort)
        "CREATE INDEX IF NOT EXISTS idx_tickets_source ON tickets(source)",
    ]
    for sql in statements:
        _exec_best_effort(sql)

    # Внешние ключи — best-effort. В Postgres нет ADD CONSTRAINT IF NOT EXISTS, проверяем вручную.
    _exec_best_effort("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_employee_id_fkey') THEN
                ALTER TABLE tickets ADD CONSTRAINT tickets_employee_id_fkey
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """)
    _exec_best_effort("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tickets_room_id_fkey') THEN
                ALTER TABLE tickets ADD CONSTRAINT tickets_room_id_fkey
                FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """)


def ensure_knowledge_core_tables() -> None:
    """
    Создаёт таблицы Knowledge Core, если их ещё нет.

    Важно: делаем checkfirst и best-effort по каждой таблице, чтобы не блокировать запуск.
    """
    try:
        from backend.modules.knowledge_core.models import (  # noqa: WPS433
            Credential,
            CredentialAccessLog,
            KnowledgeArticle,
            KnowledgeArticleFeedback,
            KnowledgeArticleIndex,
            LLMRequestLog,
            KnowledgeTicketSuggestionLog,
            NetworkDevice,
            PhysicalServer,
            Service,
            VirtualServer,
        )
    except Exception as e:
        logger.warning("Knowledge Core models import failed: %s", e)
        return

    tables = [
        NetworkDevice.__table__,
        PhysicalServer.__table__,
        VirtualServer.__table__,
        Service.__table__,
        KnowledgeArticle.__table__,
        Credential.__table__,
        CredentialAccessLog.__table__,
        LLMRequestLog.__table__,
        KnowledgeArticleIndex.__table__,
        KnowledgeArticleFeedback.__table__,
        KnowledgeTicketSuggestionLog.__table__,
    ]

    for t in tables:
        try:
            t.create(bind=engine, checkfirst=True)
        except Exception as e:
            logger.warning("startup table create skipped (%s): %s", t.name, e)


def apply_startup_migrations() -> None:
    """Применяет минимальные миграции (best-effort)."""
    try:
        ensure_users_telegram_columns()
        ensure_tickets_columns()
        ensure_knowledge_core_tables()
        logger.info(
            "✅ Startup migrations: users.telegram_*, tickets.* и knowledge_core tables готовы"
        )
    except Exception as e:
        # Не блокируем запуск приложения, но логируем проблему.
        logger.warning("⚠️ Startup migrations failed: %s", e)

