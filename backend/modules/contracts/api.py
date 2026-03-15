"""
API модуля Договора.
Префикс: /api/v1/contracts
"""
from backend.core.config import settings
from backend.modules.contracts.routes import (
    acts,
    check_inn,
    contract_types,
    contracts,
    counterparties,
    files as contract_files,
    from_document,
    reference,
)

from fastapi import APIRouter

router = APIRouter(prefix=f"{settings.api_v1_prefix}/contracts", tags=["contracts"])

# Роуты с фиксированными путями — до роутов с path-параметрами
router.include_router(from_document.router)
router.include_router(check_inn.router)
router.include_router(counterparties.router)
router.include_router(contract_types.router)
router.include_router(reference.router)
router.include_router(acts.router)  # /{contract_id}/acts — до contracts
router.include_router(contract_files.router)  # /{contract_id}/files, /{contract_id}/acts/{act_id}/files
router.include_router(contracts.router)
