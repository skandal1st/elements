"""
API роуты Knowledge Core.
Встраиваются в IT модуль под /api/v1/it/knowledge.
"""

from fastapi import APIRouter

from .routes import articles, credentials, infra, indexing


router = APIRouter(prefix="/knowledge", tags=["knowledge"])

router.include_router(articles.router)
router.include_router(infra.router)
router.include_router(credentials.router)
router.include_router(indexing.router)

