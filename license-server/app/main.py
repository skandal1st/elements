"""
Elements Platform License Server

Validates licenses for Elements Platform instances.
Provides CRUD API for managing companies and licenses.
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base
from .routes import license, admin, updates

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="License validation server for Elements Platform",
    docs_url=f"{settings.api_prefix}/docs",
    redoc_url=f"{settings.api_prefix}/redoc",
    openapi_url=f"{settings.api_prefix}/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(license.router, prefix=settings.api_prefix)
app.include_router(admin.router, prefix=settings.api_prefix)
app.include_router(updates.router, prefix=settings.api_prefix)


@app.on_event("startup")
async def startup():
    """Initialize application on startup"""
    logger.info("=" * 60)
    logger.info("Starting Elements License Server")
    logger.info(f"Version: {settings.app_version}")
    logger.info("=" * 60)

    # Create database tables
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("✓ Database tables created/verified")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise

    logger.info("=" * 60)
    logger.info("✓ License Server started successfully")
    logger.info(f"API Documentation: {settings.api_prefix}/docs")
    logger.info("=" * 60)


@app.on_event("shutdown")
async def shutdown():
    """Cleanup on application shutdown"""
    logger.info("Shutting down License Server...")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": f"{settings.api_prefix}/docs"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "license-server",
        "version": settings.app_version
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
