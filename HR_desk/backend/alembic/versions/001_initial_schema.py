"""Initial schema for Elements HR

Revision ID: 001
Revises:
Create Date: 2026-01-21

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ==========================================================================
    # Таблица users (общая для всех модулей, в public схеме)
    # Может уже существовать из init-db.sql
    # ==========================================================================
    op.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            username VARCHAR(64) UNIQUE,
            password_hash VARCHAR(255),
            full_name VARCHAR(255) NOT NULL,
            roles JSONB DEFAULT '{}',
            phone VARCHAR(32),
            avatar_url VARCHAR(512),
            is_active BOOLEAN DEFAULT TRUE,
            is_superuser BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_login_at TIMESTAMP WITH TIME ZONE
        )
    """)

    op.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)")

    # ==========================================================================
    # HR-специфичные таблицы
    # ==========================================================================

    # Departments
    op.create_table(
        "departments",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column(
            "parent_department_id",
            sa.Integer(),
            sa.ForeignKey("departments.id"),
            nullable=True,
        ),
        sa.Column("manager_id", sa.Integer(), nullable=True),  # FK добавим позже
        sa.Column("external_id", sa.String(128), nullable=True, unique=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("idx_departments_external_id", "departments", ["external_id"])
    op.create_index("idx_departments_name", "departments", ["name"])

    # Positions
    op.create_table(
        "positions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(128), nullable=False),
        sa.Column("access_template", sa.String(255), nullable=True),
        sa.Column(
            "department_id",
            sa.Integer(),
            sa.ForeignKey("departments.id"),
            nullable=True,
        ),
        sa.Column("external_id", sa.String(128), nullable=True, unique=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("idx_positions_external_id", "positions", ["external_id"])
    op.create_index("idx_positions_name", "positions", ["name"])

    # Employees
    op.create_table(
        "employees",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=True
        ),  # Связь с общей таблицей users
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column(
            "position_id", sa.Integer(), sa.ForeignKey("positions.id"), nullable=True
        ),
        sa.Column(
            "department_id",
            sa.Integer(),
            sa.ForeignKey("departments.id"),
            nullable=True,
        ),
        sa.Column(
            "manager_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=True
        ),
        sa.Column("internal_phone", sa.String(32), nullable=True),
        sa.Column("external_phone", sa.String(32), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("birthday", sa.Date(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="candidate"),
        sa.Column("uses_it_equipment", sa.Boolean(), server_default="false"),
        sa.Column("external_id", sa.String(128), nullable=True),
        sa.Column("pass_number", sa.String(64), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("idx_employees_full_name", "employees", ["full_name"])
    op.create_index("idx_employees_email", "employees", ["email"])
    op.create_index("idx_employees_status", "employees", ["status"])
    op.create_index("idx_employees_department", "employees", ["department_id"])
    op.create_index("idx_employees_external_id", "employees", ["external_id"])

    # Добавляем FK для manager_id в departments (теперь employees существует)
    op.create_foreign_key(
        "fk_departments_manager", "departments", "employees", ["manager_id"], ["id"]
    )

    # HR Requests
    op.create_table(
        "hr_requests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("type", sa.String(16), nullable=False),  # hire / fire
        sa.Column(
            "employee_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=False
        ),
        sa.Column("request_date", sa.Date(), nullable=False),
        sa.Column("effective_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="new"),
        sa.Column("needs_it_equipment", sa.Boolean(), server_default="false"),
        sa.Column("pass_number", sa.String(64), nullable=True),
        sa.Column("created_by", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("idx_hr_requests_status", "hr_requests", ["status"])
    op.create_index("idx_hr_requests_type", "hr_requests", ["type"])
    op.create_index("idx_hr_requests_effective_date", "hr_requests", ["effective_date"])

    # IT Accounts
    op.create_table(
        "it_accounts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "employee_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=False
        ),
        sa.Column("ad_account", sa.String(128), nullable=True),
        sa.Column("mailcow_account", sa.String(128), nullable=True),
        sa.Column("messenger_account", sa.String(128), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("idx_it_accounts_employee", "it_accounts", ["employee_id"])
    op.create_index("idx_it_accounts_ad", "it_accounts", ["ad_account"])

    # Equipment (HR tracking, основные данные в IT модуле)
    op.create_table(
        "hr_equipment",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("type", sa.String(128), nullable=False),
        sa.Column("serial_number", sa.String(128), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="in_use"),
        sa.Column(
            "employee_id", sa.Integer(), sa.ForeignKey("employees.id"), nullable=True
        ),
        sa.Column("it_equipment_id", sa.String(128), nullable=True),  # ID из IT модуля
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("idx_hr_equipment_employee", "hr_equipment", ["employee_id"])
    op.create_index("idx_hr_equipment_serial", "hr_equipment", ["serial_number"])

    # Audit Logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.UUID(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "user_name", sa.String(64), nullable=False
        ),  # Для отображения даже если user удалён
        sa.Column("action", sa.String(128), nullable=False),
        sa.Column("entity", sa.String(128), nullable=False),
        sa.Column("entity_id", sa.String(64), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
    )
    op.create_index("idx_audit_logs_user", "audit_logs", ["user_id"])
    op.create_index("idx_audit_logs_entity", "audit_logs", ["entity"])
    op.create_index("idx_audit_logs_created", "audit_logs", ["created_at"])

    # System Settings
    op.create_table(
        "system_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("setting_key", sa.String(64), unique=True, nullable=False),
        sa.Column("setting_value", sa.String(512), nullable=True),
        sa.Column(
            "setting_type", sa.String(32), nullable=False, server_default="general"
        ),
        sa.Column("description", sa.String(256), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_index("idx_system_settings_key", "system_settings", ["setting_key"])
    op.create_index("idx_system_settings_type", "system_settings", ["setting_type"])


def downgrade() -> None:
    op.drop_table("system_settings")
    op.drop_table("audit_logs")
    op.drop_table("hr_equipment")
    op.drop_table("it_accounts")
    op.drop_table("hr_requests")
    op.drop_constraint("fk_departments_manager", "departments", type_="foreignkey")
    op.drop_table("employees")
    op.drop_table("positions")
    op.drop_table("departments")
    # users не удаляем - это общая таблица
