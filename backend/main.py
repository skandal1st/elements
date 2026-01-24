"""
Главный файл платформы Elements
"""
import json
import logging
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from backend.core.config import settings
from backend.core import auth_routes
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
    logger.info("Elements Platform запущен успешно")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
