"""
API роуты Knowledge Core.
Встраиваются в IT модуль под /api/v1/it/knowledge.
"""

from fastapi import APIRouter

from .routes import articles, categories, credentials, indexing, infra, search, tags


router = APIRouter(prefix="/knowledge", tags=["knowledge"])

router.include_router(articles.router)
router.include_router(categories.router)
router.include_router(tags.router)
router.include_router(search.router)
router.include_router(infra.router)
router.include_router(credentials.router)
router.include_router(indexing.router)
