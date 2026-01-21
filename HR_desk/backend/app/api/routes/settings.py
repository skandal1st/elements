import os
import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_roles
from app.models.system_settings import SystemSettings
from app.models.user import User
from app.schemas.settings import (
    BrandingSettings,
    FaviconUploadResponse,
    SystemSettingOut,
    SystemSettingUpdate,
)
from app.services.audit import log_action

router = APIRouter(prefix="/settings", tags=["settings"])

UPLOAD_DIR = (
    Path(__file__).resolve().parent.parent.parent.parent / "uploads" / "branding"
)
ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/svg+xml",
    "image/x-icon",
    "image/vnd.microsoft.icon",
}
MAX_FILE_SIZE = 1024 * 1024  # 1MB

DEFAULT_BRANDING = BrandingSettings(site_title="HR Desk", site_favicon="")


def ensure_default_settings(db: Session) -> None:
    """Ensure default branding settings exist in database."""
    defaults = [
        (
            "site_title",
            "HR Desk",
            "branding",
            "Заголовок сайта (отображается во вкладке браузера)",
        ),
        ("site_favicon", "", "branding", "URL или путь к favicon"),
    ]
    for key, value, stype, desc in defaults:
        existing = (
            db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
        )
        if not existing:
            setting = SystemSettings(
                setting_key=key,
                setting_value=value,
                setting_type=stype,
                description=desc,
            )
            db.add(setting)
    db.commit()


@router.get("/branding", response_model=BrandingSettings)
def get_branding(db: Session = Depends(get_db)) -> BrandingSettings:
    """Get branding settings (public endpoint)."""
    ensure_default_settings(db)

    title_setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "site_title")
        .first()
    )
    favicon_setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "site_favicon")
        .first()
    )

    return BrandingSettings(
        site_title=title_setting.setting_value
        if title_setting and title_setting.setting_value
        else DEFAULT_BRANDING.site_title,
        site_favicon=favicon_setting.setting_value
        if favicon_setting and favicon_setting.setting_value
        else DEFAULT_BRANDING.site_favicon,
    )


@router.get("", response_model=list[SystemSettingOut])
def get_all_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
) -> list[SystemSettingOut]:
    """Get all system settings (admin only)."""
    ensure_default_settings(db)
    return db.query(SystemSettings).all()


@router.get("/{key}", response_model=SystemSettingOut)
def get_setting(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
) -> SystemSettingOut:
    """Get a specific setting by key (admin only)."""
    setting = db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Настройка не найдена")
    return setting


@router.put("/{key}", response_model=SystemSettingOut)
def update_setting(
    key: str,
    payload: SystemSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
) -> SystemSettingOut:
    """Update a setting by key (admin only)."""
    setting = db.query(SystemSettings).filter(SystemSettings.setting_key == key).first()
    if not setting:
        raise HTTPException(status_code=404, detail="Настройка не найдена")

    setting.setting_value = payload.value
    db.commit()
    db.refresh(setting)

    log_action(db, current_user.username, "update", "setting", f"key={key}")
    return setting


@router.post("/upload-favicon", response_model=FaviconUploadResponse)
async def upload_favicon(
    favicon: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
) -> FaviconUploadResponse:
    """Upload a favicon file (admin only)."""
    if favicon.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Разрешены только изображения (PNG, JPG, GIF, SVG, ICO)",
        )

    content = await favicon.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, detail="Размер файла не должен превышать 1MB"
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    ext = Path(favicon.filename).suffix.lower() if favicon.filename else ".png"
    file_path = UPLOAD_DIR / f"favicon{ext}"

    for existing_file in UPLOAD_DIR.glob("favicon.*"):
        existing_file.unlink()

    with open(file_path, "wb") as f:
        f.write(content)

    url = f"/uploads/branding/favicon{ext}"

    setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "site_favicon")
        .first()
    )
    if setting:
        setting.setting_value = url
    else:
        setting = SystemSettings(
            setting_key="site_favicon",
            setting_value=url,
            setting_type="branding",
            description="URL или путь к favicon",
        )
        db.add(setting)
    db.commit()

    log_action(
        db, current_user.username, "upload", "favicon", f"file={favicon.filename}"
    )
    return FaviconUploadResponse(url=url)


@router.delete("/favicon")
def delete_favicon(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"])),
) -> dict:
    """Delete the favicon file (admin only)."""
    setting = (
        db.query(SystemSettings)
        .filter(SystemSettings.setting_key == "site_favicon")
        .first()
    )

    if setting and setting.setting_value:
        for existing_file in UPLOAD_DIR.glob("favicon.*"):
            existing_file.unlink()
        setting.setting_value = ""
        db.commit()

    log_action(db, current_user.username, "delete", "favicon", "")
    return {"message": "Favicon удален"}
