"""
Главный файл сервера лицензирования
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import license as license_api
from config import settings

app = FastAPI(
    title="Elements License Server",
    description="Облачный сервер лицензирования для платформы Elements",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роутеры
app.include_router(license_api.router)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "license-server"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
