import logging
import threading
import time
from datetime import date
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import (
    audit,
    auth,
    birthdays,
    departments,
    employees,
    equipment,
    hr_requests,
    integrations,
    org,
    phonebook,
    positions,
    users,
    zup,
)
from app.api.routes import (
    settings as settings_routes,
)
from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal, engine
from app.models.employee import Employee
from app.models.hr_request import HRRequest
from app.models.user import User
from app.services.audit import log_action
from app.services.hr_requests import process_hr_request

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(users.router, prefix=settings.api_v1_prefix)
app.include_router(employees.router, prefix=settings.api_v1_prefix)
app.include_router(departments.router, prefix=settings.api_v1_prefix)
app.include_router(positions.router, prefix=settings.api_v1_prefix)
app.include_router(hr_requests.router, prefix=settings.api_v1_prefix)
app.include_router(phonebook.router, prefix=settings.api_v1_prefix)
app.include_router(birthdays.router, prefix=settings.api_v1_prefix)
app.include_router(org.router, prefix=settings.api_v1_prefix)
app.include_router(equipment.router, prefix=settings.api_v1_prefix)
app.include_router(audit.router, prefix=settings.api_v1_prefix)
app.include_router(integrations.router, prefix=settings.api_v1_prefix)
app.include_router(zup.router, prefix=settings.api_v1_prefix)
app.include_router(settings_routes.router, prefix=settings.api_v1_prefix)

# Mount static files for uploads
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/health")
def health_check():
    """Health check endpoint для Docker и мониторинга"""
    return {"status": "ok"}


def run_migrations() -> None:
    """Запускает миграции Alembic при старте приложения"""
    import os

    from alembic import command
    from alembic.config import Config

    try:
        # Путь к alembic.ini относительно backend директории
        alembic_cfg_path = Path(__file__).resolve().parent.parent / "alembic.ini"

        if alembic_cfg_path.exists():
            alembic_cfg = Config(str(alembic_cfg_path))
            # Устанавливаем путь к миграциям
            alembic_cfg.set_main_option(
                "script_location",
                str(Path(__file__).resolve().parent.parent / "alembic"),
            )
            # Устанавливаем URL базы данных
            alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)

            # Запускаем миграции
            command.upgrade(alembic_cfg, "head")
            logger.info("Миграции успешно применены")
        else:
            logger.warning(f"Файл alembic.ini не найден: {alembic_cfg_path}")
    except Exception as e:
        logger.error(f"Ошибка при выполнении миграций: {e}")
        # Не падаем, продолжаем работу


def seed_admin_user() -> None:
    """Создаёт первого администратора если БД пустая"""
    if not settings.seed_admin_enabled:
        return

    db = SessionLocal()
    try:
        # Проверяем есть ли пользователи
        existing = db.query(User).first()
        if existing:
            return

        # Создаём суперпользователя
        user = User(
            email=settings.seed_admin_email,
            username=settings.seed_admin_email.split("@")[0],
            password_hash=get_password_hash(settings.seed_admin_password),
            full_name="System Administrator",
            roles={"hr": "admin", "it": "admin", "doc": "admin"},
            is_superuser=True,
            is_active=True,
        )
        db.add(user)
        db.commit()
        logger.info(f"Создан администратор: {settings.seed_admin_email}")
    except Exception as e:
        logger.error(f"Ошибка создания администратора: {e}")
        db.rollback()
    finally:
        db.close()


def start_due_requests_worker() -> None:
    def _worker() -> None:
        while True:
            db = SessionLocal()
            try:
                today = date.today()
                requests = (
                    db.query(HRRequest)
                    .filter(HRRequest.status != "done")
                    .filter(HRRequest.effective_date.isnot(None))
                    .filter(HRRequest.effective_date <= today)
                    .all()
                )
                for req in requests:
                    process_hr_request(db, req)
            finally:
                db.close()
            time.sleep(60)

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()


def start_dismissed_employees_cleanup_worker() -> None:
    """Удаляет уволенных сотрудников после даты увольнения"""

    def _worker() -> None:
        while True:
            db = SessionLocal()
            try:
                today = date.today()
                # Находим все выполненные заявки на увольнение с датой <= сегодня
                fire_requests = (
                    db.query(HRRequest)
                    .filter(HRRequest.type == "fire")
                    .filter(HRRequest.status == "done")
                    .filter(HRRequest.effective_date.isnot(None))
                    .filter(HRRequest.effective_date <= today)
                    .all()
                )
                for req in fire_requests:
                    employee = (
                        db.query(Employee)
                        .filter(Employee.id == req.employee_id)
                        .first()
                    )
                    if employee and employee.status == "dismissed":
                        employee_name = employee.full_name
                        employee_id = employee.id
                        db.delete(employee)
                        db.delete(req)
                        db.commit()
                        log_action(
                            db,
                            "system",
                            "delete",
                            "employee",
                            f"id={employee_id}, name={employee_name} (уволен)",
                        )
            finally:
                db.close()
            time.sleep(3600)  # Проверка раз в час

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()


@app.on_event("startup")
def on_startup() -> None:
    """Инициализация при старте приложения"""
    logger.info("Запуск Elements HR...")

    # Применяем миграции БД
    run_migrations()

    # Создаём администратора если нужно
    seed_admin_user()

    # Запускаем фоновые процессы
    start_due_requests_worker()
    start_dismissed_employees_cleanup_worker()

    logger.info("Elements HR запущен успешно")
