<<<<<<< HEAD
"""
Главный файл платформы Elements
"""
import json
import logging
import os
import time
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.core.config import settings
from backend.core import auth_routes
from backend.modules.portal import api as portal_api
from backend.modules.hr import api as hr_api
from backend.modules.it import api as it_api
from backend.modules.tasks import api as tasks_api
from backend.modules.documents import api as documents_api
from backend.modules.contracts import api as contracts_api
from backend.modules.mail import api as mail_api

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEBUG_LOG = "/home/skandal1st/Elements/.cursor/debug.log"

app = FastAPI(
    title=settings.app_name,
    description="Единая платформа Elements",
    version="1.0.0"
)

# Static: раздача вложений тикетов (/uploads/...)
# По умолчанию email_receiver сохраняет в uploads/tickets, а в БД кладёт URL вида /uploads/tickets/<file>
_upload_dir = os.getenv("UPLOAD_DIR", "uploads/tickets")
_upload_path = Path(_upload_dir)
_uploads_root = _upload_path.parent if _upload_path.name == "tickets" else _upload_path
try:
    _uploads_root.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(_uploads_root)), name="uploads")
except Exception:
    # Не блокируем запуск приложения, если директория недоступна в окружении
    pass

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# #region agent log
@app.exception_handler(RequestValidationError)
async def _validation_exception_handler(request: Request, exc: RequestValidationError):
    body = b""
    try:
        body = await request.body()
    except Exception:
        pass
    try:
        with open(DEBUG_LOG, "a") as f:
            f.write(json.dumps({
                "location": "main:validation_handler",
                "message": "422 detail",
                "data": {"url": str(request.url), "body": body.decode("utf-8", errors="replace"), "errors": exc.errors()},
                "timestamp": int(time.time() * 1000),
                "sessionId": "debug-session",
                "hypothesisId": "H1",
            }) + "\n")
    except Exception:
        pass
    return JSONResponse(status_code=422, content={"detail": exc.errors()})
# #endregion

# Подключаем роутеры модулей
app.include_router(auth_routes.router)
app.include_router(portal_api.router)
app.include_router(hr_api.router)
app.include_router(it_api.router)
app.include_router(tasks_api.router)
app.include_router(documents_api.router)
app.include_router(contracts_api.router)
app.include_router(mail_api.router)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "elements-platform",
        "modules": settings.get_enabled_modules()
    }


@app.on_event("startup")
async def on_startup():
    """Инициализация при старте приложения"""
    logger.info("Запуск Elements Platform...")
    logger.info(f"Доступные модули: {', '.join(settings.get_enabled_modules())}")

    # Минимальные миграции (best-effort), чтобы не падать на рассинхроне схемы БД
    try:
        from backend.core.startup_migrations import apply_startup_migrations

        apply_startup_migrations()
    except Exception as e:
        logger.warning(f"Не удалось применить startup migrations: {e}")

    # Запускаем Telegram polling
    try:
        from backend.modules.it.services.telegram_service import telegram_service
        await telegram_service.start_polling()
    except Exception as e:
        logger.warning(f"Не удалось запустить Telegram polling: {e}")

    # Запускаем RocketChat polling
    try:
        from backend.modules.it.services.rocketchat_service import rocketchat_service
        await rocketchat_service.start_polling()
    except Exception as e:
        logger.warning(f"Не удалось запустить RocketChat polling: {e}")

    # Запускаем ЗУП синхронизацию
    try:
        from backend.modules.hr.services.zup_sync_service import zup_sync_service
        await zup_sync_service.start_polling()
    except Exception as e:
        logger.warning(f"Не удалось запустить ZUP sync: {e}")

    # Запускаем Email IMAP polling
    try:
        from backend.modules.it.services.email_receiver import email_receiver
        await email_receiver.start_polling()
    except Exception as e:
        logger.warning(f"Не удалось запустить Email polling: {e}")

    logger.info("Elements Platform запущен успешно")


@app.on_event("shutdown")
async def on_shutdown():
    """Очистка при остановке приложения"""
    try:
        from backend.modules.it.services.telegram_service import telegram_service
        await telegram_service.stop_polling()
    except Exception:
        pass
    try:
        from backend.modules.it.services.rocketchat_service import rocketchat_service
        await rocketchat_service.stop_polling()
    except Exception:
        pass
    try:
        from backend.modules.hr.services.zup_sync_service import zup_sync_service
        await zup_sync_service.stop_polling()
    except Exception:
        pass
    try:
        from backend.modules.it.services.email_receiver import email_receiver
        await email_receiver.stop_polling()
    except Exception:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
=======
"""
Главный файл платформы Elements
"""
import json
import logging
import os
import time
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.core.config import settings
from backend.core import auth_routes
from backend.core.edition import is_module_allowed, get_allowed_modules, get_edition_name
from backend.core.license import license_client, LicenseError

# Always load core modules
from backend.modules.portal import api as portal_api
from backend.modules.hr import api as hr_api
from backend.modules.it import api as it_api

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEBUG_LOG = "/home/skandal1st/Elements/.cursor/debug.log"

app = FastAPI(
    title=settings.app_name,
    description="Единая платформа Elements",
    version="1.0.0"
)

# Static: раздача вложений тикетов (/uploads/...)
# По умолчанию email_receiver сохраняет в uploads/tickets, а в БД кладёт URL вида /uploads/tickets/<file>
_upload_dir = os.getenv("UPLOAD_DIR", "uploads/tickets")
_upload_path = Path(_upload_dir)
_uploads_root = _upload_path.parent if _upload_path.name == "tickets" else _upload_path
try:
    _uploads_root.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=str(_uploads_root)), name="uploads")
except Exception:
    # Не блокируем запуск приложения, если директория недоступна в окружении
    pass

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# #region agent log
@app.exception_handler(RequestValidationError)
async def _validation_exception_handler(request: Request, exc: RequestValidationError):
    body = b""
    try:
        body = await request.body()
    except Exception:
        pass
    try:
        with open(DEBUG_LOG, "a") as f:
            f.write(json.dumps({
                "location": "main:validation_handler",
                "message": "422 detail",
                "data": {"url": str(request.url), "body": body.decode("utf-8", errors="replace"), "errors": exc.errors()},
                "timestamp": int(time.time() * 1000),
                "sessionId": "debug-session",
                "hypothesisId": "H1",
            }) + "\n")
    except Exception:
        pass
    return JSONResponse(status_code=422, content={"detail": exc.errors()})
# #endregion

# Подключаем роутеры модулей
app.include_router(auth_routes.router)
app.include_router(portal_api.router)
app.include_router(hr_api.router)
app.include_router(it_api.router)

# Conditionally load enterprise modules
if is_module_allowed("tasks"):
    from backend.modules.tasks import api as tasks_api
    app.include_router(tasks_api.router)
    logger.info("✓ Tasks module loaded (Enterprise)")
else:
    logger.info("✗ Tasks module not available (requires Enterprise edition)")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "elements-platform",
        "edition": get_edition_name(),
        "modules": get_allowed_modules()
    }


@app.on_event("startup")
async def on_startup():
    """Инициализация при старте приложения"""
    logger.info("=" * 60)
    logger.info("Starting Elements Platform")
    logger.info(f"Edition: {get_edition_name()}")
    logger.info(f"Available modules: {', '.join(get_allowed_modules())}")
    logger.info("=" * 60)

    # LICENSE VALIDATION (must be first in production)
    environment = os.getenv("ENVIRONMENT", "development")
    if environment == "production":
        try:
            logger.info("Validating license...")
            license_data = await license_client.validate_license()
            logger.info(f"✓ License valid until {license_data['expires_at']}")
            logger.info(f"✓ Edition: {license_data['edition']}")
            logger.info(f"✓ Modules: {', '.join(license_data['modules'])}")
            if license_data.get('max_users'):
                logger.info(f"✓ Max users: {license_data['max_users']}")
        except LicenseError as e:
            logger.error("=" * 60)
            logger.error(f"❌ LICENSE ERROR: {e}")
            logger.error("=" * 60)
            logger.error("Application will not start without valid license in production")
            logger.error("Please check:")
            logger.error("  - LICENSE_SERVER_URL is set correctly")
            logger.error("  - COMPANY_ID is set correctly")
            logger.error("  - License is not expired")
            logger.error("  - Hardware ID matches license")
            logger.error("=" * 60)
            raise SystemExit(1)
    else:
        logger.info("Running in development mode (license validation skipped)")

    # Минимальные миграции (best-effort), чтобы не падать на рассинхроне схемы БД
    try:
        from backend.core.startup_migrations import apply_startup_migrations

        apply_startup_migrations()
    except Exception as e:
        logger.warning(f"Не удалось применить startup migrations: {e}")

    # Запускаем Telegram polling
    try:
        from backend.modules.it.services.telegram_service import telegram_service
        await telegram_service.start_polling()
    except Exception as e:
        logger.warning(f"Не удалось запустить Telegram polling: {e}")

    # Запускаем RocketChat polling (только Enterprise)
    if is_module_allowed("knowledge_core"):  # RocketChat is Enterprise feature
        try:
            from backend.modules.it.services.rocketchat_service import rocketchat_service
            await rocketchat_service.start_polling()
        except Exception as e:
            logger.warning(f"Не удалось запустить RocketChat polling: {e}")

    logger.info("=" * 60)
    logger.info("✓ Elements Platform started successfully")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def on_shutdown():
    """Очистка при остановке приложения"""
    logger.info("Shutting down Elements Platform...")

    try:
        from backend.modules.it.services.telegram_service import telegram_service
        await telegram_service.stop_polling()
    except Exception:
        pass

    if is_module_allowed("knowledge_core"):  # RocketChat is Enterprise feature
        try:
            from backend.modules.it.services.rocketchat_service import rocketchat_service
            await rocketchat_service.stop_polling()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
>>>>>>> 1c0b322 (поправлены выпадающие меню)
