"""
Скрипт для создания таблиц и seed данных
"""

import sys
from pathlib import Path

# Добавляем корень проекта в путь
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

import bcrypt
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from backend.core.config import settings
from backend.core.database import Base, engine
from backend.modules.hr.models.audit_log import AuditLog
from backend.modules.hr.models.department import Department
from backend.modules.hr.models.employee import Employee
from backend.modules.hr.models.equipment import HREquipment
from backend.modules.hr.models.hr_request import HRRequest
from backend.modules.hr.models.position import Position
from backend.modules.hr.models.system_settings import SystemSettings

# Импортируем модели напрямую из файлов для регистрации в Base
# HR модели (кроме Equipment - конфликт имен с IT Equipment)
from backend.modules.hr.models.user import User

# IT модели
from backend.modules.it.models import (
    Brand,
    Building,
    Consumable,
    ConsumableIssue,
    ConsumableSupply,
    Dictionary,
    Equipment,
    EquipmentHistory,
    EquipmentModel,
    EquipmentRequest,
    EquipmentType,
    LicenseAssignment,
    ModelConsumable,
    ModelSpecification,
    Notification,
    Room,
    SoftwareLicense,
    Ticket,
    TicketComment,
    TicketConsumable,
    TicketHistory,
)

# Модели модуля Tasks (регистрация в Base для create_all)
import backend.modules.tasks.models  # noqa: F401, E402


def get_password_hash(password: str) -> str:
    """Хеширует пароль используя bcrypt напрямую"""
    # Ограничиваем длину пароля для bcrypt (максимум 72 байта)
    password_bytes = password.encode("utf-8")
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def migrate_ticket_history_and_source():
    """Добавляет поля source, email_sender, email_message_id в tickets и создает таблицу ticket_history"""
    print("Проверка миграций для расширенной тикет-системы...")

    with engine.connect() as conn:
        try:
            # Проверяем существование колонки source в tickets
            result = conn.execute(
                text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'tickets' AND column_name = 'source'
            """)
            )

            if not result.fetchone():
                print("Добавление колонки source в таблицу tickets...")
                conn.execute(
                    text("""
                    ALTER TABLE tickets
                    ADD COLUMN source VARCHAR(20) DEFAULT 'web' NOT NULL
                """)
                )
                conn.commit()

            # Проверяем существование колонки email_sender
            result = conn.execute(
                text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'tickets' AND column_name = 'email_sender'
            """)
            )

            if not result.fetchone():
                print("Добавление колонки email_sender в таблицу tickets...")
                conn.execute(
                    text("""
                    ALTER TABLE tickets
                    ADD COLUMN email_sender VARCHAR(255)
                """)
                )
                conn.commit()

            # Проверяем существование колонки email_message_id
            result = conn.execute(
                text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'tickets' AND column_name = 'email_message_id'
            """)
            )

            if not result.fetchone():
                print("Добавление колонки email_message_id в таблицу tickets...")
                conn.execute(
                    text("""
                    ALTER TABLE tickets
                    ADD COLUMN email_message_id VARCHAR(255)
                """)
                )
                conn.commit()

            # Делаем creator_id nullable если еще не nullable
            result = conn.execute(
                text("""
                SELECT is_nullable
                FROM information_schema.columns
                WHERE table_name = 'tickets' AND column_name = 'creator_id'
            """)
            )
            row = result.fetchone()
            if row and row[0] == "NO":
                print("Делаем creator_id nullable в таблице tickets...")
                conn.execute(
                    text("""
                    ALTER TABLE tickets
                    ALTER COLUMN creator_id DROP NOT NULL
                """)
                )
                conn.commit()

            # Проверяем существование таблицы ticket_history
            result = conn.execute(
                text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_name = 'ticket_history'
            """)
            )

            if not result.fetchone():
                print("Создание таблицы ticket_history...")
                conn.execute(
                    text("""
                    CREATE TABLE ticket_history (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
                        changed_by_id UUID NOT NULL REFERENCES users(id),
                        field VARCHAR(50) NOT NULL,
                        old_value TEXT,
                        new_value TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    )
                """)
                )
                conn.execute(
                    text("""
                    CREATE INDEX idx_ticket_history_ticket_id ON ticket_history(ticket_id)
                """)
                )
                conn.commit()

            # Создаем индекс для source если не существует
            result = conn.execute(
                text("""
                SELECT indexname FROM pg_indexes WHERE indexname = 'idx_tickets_source'
            """)
            )
            if not result.fetchone():
                print("Создание индекса idx_tickets_source...")
                conn.execute(
                    text("""
                    CREATE INDEX idx_tickets_source ON tickets(source)
                """)
                )
                conn.commit()

            print("✅ Миграция тикет-системы выполнена успешно")
        except Exception as e:
            print(f"⚠️  Ошибка миграции тикет-системы: {e}")
            conn.rollback()


def migrate_ticket_employee_link():
    """Добавляет поле employee_id в tickets для привязки к сотруднику (Employee)."""
    print("Проверка миграций для привязки тикетов к сотрудникам...")

    with engine.connect() as conn:
        try:
            # Проверяем существование колонки employee_id в tickets
            result = conn.execute(
                text(
                    """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'tickets' AND column_name = 'employee_id'
            """
                )
            )

            if not result.fetchone():
                print("Добавление колонки employee_id в таблицу tickets...")
                conn.execute(
                    text(
                        """
                    ALTER TABLE tickets
                    ADD COLUMN employee_id INTEGER
                """
                    )
                )
                conn.commit()

            # Пытаемся добавить FK (если его нет). Не падаем, если таблица/constraint уже есть.
            fk_exists = conn.execute(
                text(
                    """
                SELECT conname
                FROM pg_constraint
                WHERE conname = 'tickets_employee_id_fkey'
            """
                )
            ).fetchone()

            if not fk_exists:
                try:
                    print("Добавление внешнего ключа tickets_employee_id_fkey...")
                    conn.execute(
                        text(
                            """
                        ALTER TABLE tickets
                        ADD CONSTRAINT tickets_employee_id_fkey
                        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
                    """
                        )
                    )
                    conn.commit()
                except Exception:
                    conn.rollback()
                    # FK может не добавиться, если нет таблицы employees в текущей БД/схеме или прав
                    pass

            print("✅ Миграция привязки тикетов к сотрудникам выполнена успешно")
        except Exception as e:
            print(f"⚠️  Ошибка миграции привязки тикетов к сотрудникам: {e}")
            conn.rollback()


def migrate_rooms_and_related():
    """Создает таблицу rooms и добавляет room_id в связанные таблицы"""
    print("Проверка миграций для кабинетов...")

    with engine.connect() as conn:
        try:
            # Проверяем существование таблицы rooms
            result = conn.execute(
                text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_name = 'rooms'
            """)
            )

            if not result.fetchone():
                print("Создание таблицы rooms...")
                from backend.modules.it.models import Room

                Room.__table__.create(bind=engine, checkfirst=True)

            # Проверяем и добавляем room_id в employees
            result = conn.execute(
                text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'employees' AND column_name = 'room_id'
            """)
            )

            if not result.fetchone():
                print("Добавление колонки room_id в таблицу employees...")
                conn.execute(
                    text("""
                    ALTER TABLE employees
                    ADD COLUMN room_id UUID REFERENCES rooms(id) ON DELETE SET NULL
                """)
                )
                conn.commit()

            # Проверяем и добавляем room_id в tickets
            result = conn.execute(
                text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'tickets' AND column_name = 'room_id'
            """)
            )

            if not result.fetchone():
                print("Добавление колонки room_id в таблицу tickets...")
                conn.execute(
                    text("""
                    ALTER TABLE tickets
                    ADD COLUMN room_id UUID REFERENCES rooms(id) ON DELETE SET NULL
                """)
                )
                conn.commit()

            # Проверяем и добавляем room_id в equipment (если еще не добавлена)
            result = conn.execute(
                text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'equipment' AND column_name = 'room_id'
            """)
            )

            if not result.fetchone():
                print("Добавление колонки room_id в таблицу equipment...")
                conn.execute(
                    text("""
                    ALTER TABLE equipment
                    ADD COLUMN room_id UUID REFERENCES rooms(id) ON DELETE SET NULL
                """)
                )
                conn.commit()

            print("✅ Миграция кабинетов выполнена успешно")
        except Exception as e:
            print(f"⚠️  Ошибка миграции кабинетов: {e}")
            conn.rollback()


def migrate_equipment_table():
    """Добавляет колонку model_id в таблицу equipment если её нет"""
    print("Проверка миграций таблицы equipment...")

    with engine.connect() as conn:
        try:
            # Проверяем существование колонки model_id
            result = conn.execute(
                text("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'equipment' AND column_name = 'model_id'
            """)
            )

            if result.fetchone():
                print("Колонка model_id уже существует, пропускаем миграцию")
                return

            # Проверяем существование таблиц справочника
            result = conn.execute(
                text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_name = 'equipment_models'
            """)
            )

            if not result.fetchone():
                print(
                    "Таблица equipment_models не существует, создаем таблицы справочника..."
                )
                # Создаем только таблицы справочника
                from backend.modules.it.models import (
                    Brand,
                    EquipmentModel,
                    EquipmentType,
                    ModelConsumable,
                    ModelSpecification,
                )

                Brand.__table__.create(bind=engine, checkfirst=True)
                EquipmentType.__table__.create(bind=engine, checkfirst=True)
                EquipmentModel.__table__.create(bind=engine, checkfirst=True)
                ModelSpecification.__table__.create(bind=engine, checkfirst=True)
                ModelConsumable.__table__.create(bind=engine, checkfirst=True)

            # Добавляем колонку model_id
            print("Добавление колонки model_id в таблицу equipment...")
            conn.execute(
                text("""
                ALTER TABLE equipment
                ADD COLUMN model_id UUID REFERENCES equipment_models(id) ON DELETE SET NULL
            """)
            )
            conn.commit()
            print("✅ Миграция выполнена успешно")
        except Exception as e:
            print(f"⚠️  Ошибка миграции: {e}")
            conn.rollback()
            # Не прерываем выполнение, так как это может быть первичная инициализация


def migrate_consumable_supplies():
    """Создает таблицу consumable_supplies если её нет"""
    print("Проверка миграции для поставок расходников...")

    with engine.connect() as conn:
        try:
            # Проверяем существование таблицы consumable_supplies
            result = conn.execute(
                text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_name = 'consumable_supplies'
            """)
            )

            if not result.fetchone():
                print("Создание таблицы consumable_supplies...")
                ConsumableSupply.__table__.create(bind=engine, checkfirst=True)
                print("✅ Таблица consumable_supplies создана")
            else:
                print("Таблица consumable_supplies уже существует")

        except Exception as e:
            print(f"⚠️  Ошибка миграции поставок: {e}")
            conn.rollback()


def migrate_ticket_consumables():
    """Создает таблицу ticket_consumables для связи тикетов с расходниками"""
    print("Проверка миграции ticket_consumables...")

    with engine.connect() as conn:
        try:
            # Проверяем существование таблицы ticket_consumables
            result = conn.execute(
                text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_name = 'ticket_consumables'
            """)
            )

            if not result.fetchone():
                print("Создание таблицы ticket_consumables...")
                TicketConsumable.__table__.create(bind=engine, checkfirst=True)
                print("✅ Таблица ticket_consumables создана")
            else:
                print("Таблица ticket_consumables уже существует")

        except Exception as e:
            print(f"⚠️  Ошибка миграции ticket_consumables: {e}")
            conn.rollback()


def migrate_telegram_fields():
    """Добавляет поля Telegram интеграции в таблицу users"""
    print("Проверка миграций для Telegram интеграции...")

    with engine.connect() as conn:
        try:
            columns_to_add = [
                ("telegram_id", "BIGINT UNIQUE"),
                ("telegram_username", "VARCHAR(255)"),
                ("telegram_notifications", "BOOLEAN DEFAULT FALSE"),
                ("telegram_link_code", "VARCHAR(6)"),
                ("telegram_link_code_expires", "TIMESTAMPTZ"),
            ]

            for col_name, col_type in columns_to_add:
                result = conn.execute(
                    text("""
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name = :col_name
                """),
                    {"col_name": col_name},
                )

                if not result.fetchone():
                    print(f"Добавление колонки {col_name} в таблицу users...")
                    conn.execute(
                        text(
                            f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"
                        )
                    )
                    conn.commit()

            print("✅ Миграция Telegram полей выполнена успешно")
        except Exception as e:
            print(f"⚠️  Ошибка миграции Telegram полей: {e}")
            conn.rollback()


def _get_db_user_from_url(url: str) -> str:
    """Извлекает имя пользователя БД из DATABASE_URL."""
    if "://" not in url:
        return "elements"
    rest = url.split("://", 1)[1]
    if "@" in rest:
        user_part = rest.split("@", 1)[0]
        return user_part.split(":")[0]
    return "elements"


def ensure_tasks_schema():
    """Создаёт схему tasks и выдаёт права, если её ещё нет."""
    db_user = _get_db_user_from_url(settings.database_url)
    with engine.begin() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS tasks"))
        conn.execute(text(f"GRANT ALL ON SCHEMA tasks TO {db_user}"))
    print("Схема tasks готова")


def create_tables():
    """Создает все таблицы в БД"""
    print("Создание таблиц...")
    ensure_tasks_schema()
    Base.metadata.create_all(bind=engine)
    print("Таблицы созданы успешно")

    # Применяем миграции для существующих таблиц
    migrate_equipment_table()
    migrate_rooms_and_related()
    migrate_ticket_history_and_source()
    migrate_ticket_employee_link()
    migrate_consumable_supplies()
    migrate_ticket_consumables()
    migrate_telegram_fields()


def seed_admin_user():
    """Создает первого администратора"""
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # Проверяем, есть ли уже пользователи
        existing = db.query(User).first()
        if existing:
            print(f"Пользователи уже существуют. Первый пользователь: {existing.email}")
            return

        # Создаем администратора
        admin_email = getattr(settings, "seed_admin_email", "admin@elements.local")
        admin_password = getattr(settings, "seed_admin_password", "admin123")

        # Ограничиваем длину пароля для bcrypt (максимум 72 байта)
        if len(admin_password.encode("utf-8")) > 72:
            admin_password = admin_password[:72]

        print(f"Создание администратора: {admin_email}")

        admin = User(
            email=admin_email,
            username=admin_email.split("@")[0],
            password_hash=get_password_hash(admin_password),
            full_name="System Administrator",
            roles={"hr": "admin", "it": "admin"},
            is_superuser=True,
            is_active=True,
        )

        db.add(admin)
        db.commit()
        db.refresh(admin)

        print(f"✅ Администратор создан:")
        print(f"   Email: {admin_email}")
        print(f"   Password: {admin_password}")
        print(f"   ID: {admin.id}")

    except Exception as e:
        print(f"❌ Ошибка создания администратора: {e}")
        db.rollback()
    finally:
        db.close()


def seed_dictionaries():
    """Создает начальные данные справочников"""
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        # Проверяем, есть ли уже справочники
        existing = db.query(Dictionary).first()
        if existing:
            print("Справочники уже существуют, пропускаем seed")
            return

        print("Создание начальных справочников...")

        dictionaries_data = [
            # Категории заявок
            ("ticket_category", "hardware", "Оборудование", None, None, 1),
            ("ticket_category", "software", "Программное обеспечение", None, None, 2),
            ("ticket_category", "network", "Сеть", None, None, 3),
            ("ticket_category", "access", "Доступ", None, None, 4),
            ("ticket_category", "other", "Прочее", None, None, 5),
            # Приоритеты заявок
            ("ticket_priority", "low", "Низкий", "#6b7280", None, 1),
            ("ticket_priority", "normal", "Обычный", "#3b82f6", None, 2),
            ("ticket_priority", "high", "Высокий", "#f59e0b", None, 3),
            ("ticket_priority", "urgent", "Срочный", "#ef4444", None, 4),
            # Статусы заявок
            ("ticket_status", "open", "Открыта", "#3b82f6", None, 1),
            ("ticket_status", "in_progress", "В работе", "#f59e0b", None, 2),
            ("ticket_status", "resolved", "Решена", "#10b981", None, 3),
            ("ticket_status", "closed", "Закрыта", "#6b7280", None, 4),
            ("ticket_status", "cancelled", "Отменена", "#ef4444", None, 5),
            # Категории оборудования
            ("equipment_category", "computer", "Компьютер", None, None, 1),
            ("equipment_category", "monitor", "Монитор", None, None, 2),
            ("equipment_category", "printer", "Принтер", None, None, 3),
            ("equipment_category", "network", "Сетевое оборудование", None, None, 4),
            ("equipment_category", "server", "Сервер", None, None, 5),
            ("equipment_category", "mobile", "Мобильное устройство", None, None, 6),
            ("equipment_category", "peripheral", "Периферия", None, None, 7),
            ("equipment_category", "other", "Прочее", None, None, 8),
            # Статусы оборудования
            ("equipment_status", "in_use", "В работе", "#10b981", None, 1),
            ("equipment_status", "in_stock", "На складе", "#3b82f6", None, 2),
            ("equipment_status", "in_repair", "В ремонте", "#f59e0b", None, 3),
            ("equipment_status", "written_off", "Списано", "#6b7280", None, 4),
            # Типы расходников
            ("consumable_type", "cartridge", "Картридж", None, None, 1),
            ("consumable_type", "drum", "Фотобарабан", None, None, 2),
            ("consumable_type", "toner", "Тонер", None, None, 3),
            ("consumable_type", "ink", "Чернила", None, None, 4),
            ("consumable_type", "paper", "Бумага", None, None, 5),
            ("consumable_type", "other", "Прочее", None, None, 6),
        ]

        for dict_type, key, label, color, icon, sort_order in dictionaries_data:
            # Проверяем, не существует ли уже такой элемент
            existing = (
                db.query(Dictionary)
                .filter(Dictionary.dictionary_type == dict_type, Dictionary.key == key)
                .first()
            )

            if not existing:
                dic = Dictionary(
                    dictionary_type=dict_type,
                    key=key,
                    label=label,
                    color=color,
                    icon=icon,
                    sort_order=sort_order,
                    is_active=True,
                    is_system=True,
                )
                db.add(dic)

        db.commit()
        print(f"✅ Создано {len(dictionaries_data)} элементов справочников")

    except Exception as e:
        print(f"❌ Ошибка создания справочников: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 60)
    print("Инициализация базы данных Elements Platform")
    print("=" * 60)

    # Отладочный вывод
    db_url_display = settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url
    print(f"\nПодключение к БД: {db_url_display}")
    
    # Проверяем, что пароль не пустой
    if '@' in settings.database_url:
        db_parts = settings.database_url.split('@')[0].replace('postgresql://', '').split(':')
        if len(db_parts) >= 2 and not db_parts[1]:
            print("⚠️  ВНИМАНИЕ: Пароль БД пустой! Проверьте переменную DATABASE_URL")
            sys.exit(1)

    create_tables()
    print()
    seed_admin_user()
    print()
    seed_dictionaries()

    print("\n" + "=" * 60)
    print("Инициализация завершена")
    print("=" * 60)
