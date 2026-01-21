from logging.config import fileConfig

from alembic import context

# Импортируем настройки и модели
from app.core.config import settings
from app.db.base import Base
from app.models.audit_log import AuditLog
from app.models.department import Department
from app.models.employee import Employee
from app.models.equipment import Equipment
from app.models.hr_request import HRRequest
from app.models.it_account import ITAccount
from app.models.position import Position
from app.models.system_settings import SystemSettings

# Импортируем все модели для автоматической генерации миграций
from app.models.user import User
from sqlalchemy import engine_from_config, pool

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Метаданные моделей для автогенерации
target_metadata = Base.metadata

# Переопределяем URL из настроек приложения
config.set_main_option("sqlalchemy.url", settings.database_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
