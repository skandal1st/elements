"""Эндпоинты управления платформенной лицензией."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.modules.hr.dependencies import (
    get_current_user,
    get_db,
    require_superuser,
)
from backend.modules.hr.models.platform_license import PlatformLicense
from backend.modules.hr.models.user import User
from backend.modules.hr.services.audit import log_action
from backend.core.license import get_or_create_instance_id
from backend.core.platform_license import (
    LicenseValidationError,
    get_license_status,
    install_license,
)
from backend.modules.platform.schemas.license import (
    HardwareIdOut,
    LicenseHistoryEntry,
    LicenseInstallIn,
    LicenseStatusOut,
)

router = APIRouter(prefix="/license", tags=["platform-license"])


@router.get("/status", response_model=LicenseStatusOut)
def status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return get_license_status(db)


@router.post("/install", response_model=LicenseStatusOut)
def install(
    payload: LicenseInstallIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser),
) -> dict:
    try:
        license_row = install_license(db, payload.license_key, installed_by_id=current_user.id)
    except LicenseValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Не удалось установить лицензию: {exc}")

    log_action(
        db,
        current_user.username or current_user.email,
        "license_install",
        "platform_license",
        f"id={license_row.id}, expires_at={license_row.expires_at}",
    )
    return get_license_status(db)


@router.get("/hardware-id", response_model=HardwareIdOut)
def hardware_id(_: User = Depends(require_superuser)) -> dict:
    return {"hardware_id": get_or_create_instance_id()}


@router.get("/history", response_model=List[LicenseHistoryEntry])
def history(
    db: Session = Depends(get_db),
    _: User = Depends(require_superuser),
) -> list:
    return (
        db.query(PlatformLicense)
        .order_by(PlatformLicense.installed_at.desc())
        .all()
    )
