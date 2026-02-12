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
            ArticleKeyword,
            Credential,
            CredentialAccessLog,
            KnowledgeArticle,
            KnowledgeArticleFeedback,
            KnowledgeArticleIndex,
            KnowledgeArticleTag,
            KnowledgeCategory,
            KnowledgeTag,
            LLMRequestLog,
            KnowledgeTicketSuggestionLog,
            NetworkDevice,
            PhysicalServer,
            SearchQuery,
            Service,
            VirtualServer,
        )
    except Exception as e:
        logger.warning("Knowledge Core models import failed: %s", e)
        return

    tables = [
        KnowledgeCategory.__table__,
        KnowledgeTag.__table__,
        NetworkDevice.__table__,
        PhysicalServer.__table__,
        VirtualServer.__table__,
        Service.__table__,
        KnowledgeArticle.__table__,
        KnowledgeArticleTag.__table__,
        ArticleKeyword.__table__,
        SearchQuery.__table__,
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


def ensure_knowledge_core_article_extensions() -> None:
    """
    Добавляет новые колонки Phase 1 в knowledge_articles,
    создаёт search_vector, GIN-индекс и триггер tsvector.
    """
    columns = [
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS article_type VARCHAR(32)",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS category_id UUID",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS summary TEXT",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS difficulty_level VARCHAR(16)",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS author_id UUID",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS last_editor_id UUID",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0 NOT NULL",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS helpful_count INTEGER DEFAULT 0 NOT NULL",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS not_helpful_count INTEGER DEFAULT 0 NOT NULL",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE NOT NULL",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE NOT NULL",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ",
        "ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS search_vector tsvector",
    ]
    for sql in columns:
        _exec_best_effort(sql)

    # Foreign keys (best-effort)
    _exec_best_effort("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ka_category_id_fkey') THEN
                ALTER TABLE knowledge_articles ADD CONSTRAINT ka_category_id_fkey
                FOREIGN KEY (category_id) REFERENCES knowledge_categories(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """)
    _exec_best_effort("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ka_author_id_fkey') THEN
                ALTER TABLE knowledge_articles ADD CONSTRAINT ka_author_id_fkey
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """)
    _exec_best_effort("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ka_last_editor_id_fkey') THEN
                ALTER TABLE knowledge_articles ADD CONSTRAINT ka_last_editor_id_fkey
                FOREIGN KEY (last_editor_id) REFERENCES users(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """)

    # Indices
    _exec_best_effort("CREATE INDEX IF NOT EXISTS idx_ka_search_vector ON knowledge_articles USING GIN (search_vector)")
    _exec_best_effort("CREATE INDEX IF NOT EXISTS idx_ka_category_id ON knowledge_articles (category_id)")
    _exec_best_effort("CREATE INDEX IF NOT EXISTS idx_ka_article_type ON knowledge_articles (article_type)")
    _exec_best_effort("CREATE INDEX IF NOT EXISTS idx_ka_published_at ON knowledge_articles (published_at)")
    _exec_best_effort("CREATE INDEX IF NOT EXISTS idx_ka_keywords_article ON knowledge_article_keywords (article_id)")
    _exec_best_effort("CREATE INDEX IF NOT EXISTS idx_ka_keywords_keyword ON knowledge_article_keywords (keyword)")

    # tsvector auto-update trigger (Russian config, weights A/B/C for title/summary/content)
    _exec_best_effort("""
        CREATE OR REPLACE FUNCTION knowledge_articles_search_vector_update() RETURNS trigger AS $$
        BEGIN
            NEW.search_vector :=
                setweight(to_tsvector('russian', coalesce(NEW.title, '')), 'A') ||
                setweight(to_tsvector('russian', coalesce(NEW.summary, '')), 'B') ||
                setweight(to_tsvector('russian', coalesce(NEW.raw_content, '')), 'C') ||
                setweight(to_tsvector('russian', coalesce(NEW.normalized_content, '')), 'C');
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    _exec_best_effort("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ka_search_vector') THEN
                CREATE TRIGGER trg_ka_search_vector
                BEFORE INSERT OR UPDATE ON knowledge_articles
                FOR EACH ROW EXECUTE FUNCTION knowledge_articles_search_vector_update();
            END IF;
        END $$;
    """)

    # Backfill search_vector for existing rows
    _exec_best_effort("""
        UPDATE knowledge_articles SET search_vector =
            setweight(to_tsvector('russian', coalesce(title, '')), 'A') ||
            setweight(to_tsvector('russian', coalesce(summary, '')), 'B') ||
            setweight(to_tsvector('russian', coalesce(raw_content, '')), 'C') ||
            setweight(to_tsvector('russian', coalesce(normalized_content, '')), 'C')
        WHERE search_vector IS NULL
    """)


def ensure_zabbix_integration_columns() -> None:
    """
    Добавляет колонки для интеграции с Zabbix: zabbix_template_id в каталоге,
    zabbix_host_id в equipment.
    """
    statements = [
        "ALTER TABLE equipment_types ADD COLUMN IF NOT EXISTS zabbix_template_id VARCHAR(64)",
        "ALTER TABLE equipment_models ADD COLUMN IF NOT EXISTS zabbix_template_id VARCHAR(64)",
        "ALTER TABLE equipment ADD COLUMN IF NOT EXISTS zabbix_host_id VARCHAR(32)",
    ]
    for sql in statements:
        _exec_best_effort(sql)


def ensure_equipment_category_network() -> None:
    """Добавляет категорию equipment_category 'network' в словарь, если её ещё нет."""
    try:
        from backend.modules.it.models import Dictionary
        from backend.core.database import SessionLocal
        db = SessionLocal()
        try:
            existing = (
                db.query(Dictionary)
                .filter(
                    Dictionary.dictionary_type == "equipment_category",
                    Dictionary.key == "network",
                )
                .first()
            )
            if not existing:
                db.add(
                    Dictionary(
                        dictionary_type="equipment_category",
                        key="network",
                        label="Сетевое оборудование",
                        sort_order=4,
                        is_active=True,
                        is_system=True,
                    )
                )
                db.commit()
                logger.info("Добавлена категория equipment_category: network")
        finally:
            db.close()
    except Exception as e:
        logger.warning("ensure_equipment_category_network skipped: %s", e)


def ensure_rocketchat_columns() -> None:
    """
    Добавляет колонки для интеграции с RocketChat в таблицу tickets.
    """
    statements = [
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rocketchat_message_id VARCHAR(255)",
        "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rocketchat_sender VARCHAR(255)",
    ]
    for sql in statements:
        _exec_best_effort(sql)


def ensure_rustdesk_column() -> None:
    """Добавить колонку rustdesk_id в таблицу equipment."""
    statements = [
        "ALTER TABLE equipment ADD COLUMN IF NOT EXISTS rustdesk_id VARCHAR(255)",
    ]
    for sql in statements:
        _exec_best_effort(sql)


def ensure_license_assignments_employee_id() -> None:
    """Добавить employee_id в license_assignments для привязки к сотрудникам."""
    _exec_best_effort("""
        ALTER TABLE license_assignments ADD COLUMN IF NOT EXISTS employee_id INTEGER
    """)
    _exec_best_effort("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'license_assignments_employee_id_fkey') THEN
                ALTER TABLE license_assignments ADD CONSTRAINT license_assignments_employee_id_fkey
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """)


def apply_startup_migrations() -> None:
    """Применяет минимальные миграции (best-effort)."""
    try:
        ensure_users_telegram_columns()
        ensure_tickets_columns()
        ensure_knowledge_core_tables()
        ensure_knowledge_core_article_extensions()
        ensure_zabbix_integration_columns()
        ensure_equipment_category_network()
        ensure_rocketchat_columns()
        ensure_rustdesk_column()
        ensure_license_assignments_employee_id()
        logger.info(
            "✅ Startup migrations: users.telegram_*, tickets.*, knowledge_core, zabbix, rocketchat и rustdesk колонки готовы"
        )
    except Exception as e:
        # Не блокируем запуск приложения, но логируем проблему.
        logger.warning("⚠️ Startup migrations failed: %s", e)

