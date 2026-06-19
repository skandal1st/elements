"""
Офлайн платформенная лицензия с RSA-PSS-SHA256 подписью.

Формат ключа:
    ELEM-LIC-v1.<base64url(payload_json)>.<base64url(signature)>

payload_json (canonical):
    {
      "license_id": "uuid",
      "customer_name": "ООО Ромашка",
      "edition": "core" | "enterprise",
      "modules": ["hr","it",...],
      "max_users": 50,
      "features": {"rocketchat": true},
      "hardware_id": "sha256-or-null",
      "issued_at": "2026-01-01T00:00:00Z",
      "expires_at": "2027-01-01T00:00:00Z",
      "issuer": "elements-vendor"
    }

Публичный ключ для проверки — backend/core/license_pubkey.pem (RSA 4096).
"""
from __future__ import annotations

import base64
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from sqlalchemy.orm import Session

from backend.core.config import settings
from backend.core.license import get_or_create_instance_id

logger = logging.getLogger(__name__)

GRACE_PERIOD_DAYS = int(getattr(settings, "license_grace_days", 14))
LICENSE_PREFIX = "ELEM-LIC-v1."

_public_key_cache: Optional[rsa.RSAPublicKey] = None


class LicenseValidationError(Exception):
    """Подпись/срок/hardware_id лицензии не прошли проверку."""


def _public_key_path() -> Path:
    raw = getattr(settings, "license_public_key_path", "backend/core/license_pubkey.pem")
    p = Path(raw)
    if not p.is_absolute():
        # Относительно репо: backend/core/platform_license.py → ../..
        p = Path(__file__).resolve().parent.parent.parent / raw
    return p


def load_public_key() -> rsa.RSAPublicKey:
    """Однократно загрузить публичный ключ. Fail-fast при отсутствии в production."""
    global _public_key_cache
    if _public_key_cache is not None:
        return _public_key_cache

    path = _public_key_path()
    if not path.exists():
        raise LicenseValidationError(
            f"Публичный ключ лицензии не найден: {path}. "
            "Положите PEM-файл рядом с приложением."
        )

    with path.open("rb") as f:
        key = serialization.load_pem_public_key(f.read())

    if not isinstance(key, rsa.RSAPublicKey):
        raise LicenseValidationError("Публичный ключ лицензии должен быть RSA")

    _public_key_cache = key
    return key


def _b64url_decode(s: str) -> bytes:
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _parse_iso(value: str) -> datetime:
    # Допускаем 'Z' суффикс
    v = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(v)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def verify_license_key(key: str, *, check_hardware: bool = True) -> dict[str, Any]:
    """
    Проверяет формат, подпись, срок и hardware_id лицензионного ключа.

    Возвращает распарсенный payload (dict) или поднимает LicenseValidationError.
    Grace-период учитывается: ключ ещё валиден GRACE_PERIOD_DAYS дней после expires_at.
    """
    if not key or not isinstance(key, str):
        raise LicenseValidationError("Лицензионный ключ пуст")

    key = key.strip()
    if not key.startswith(LICENSE_PREFIX):
        raise LicenseValidationError("Неверный префикс лицензионного ключа")

    parts = key[len(LICENSE_PREFIX):].split(".")
    if len(parts) != 2:
        raise LicenseValidationError("Неверный формат лицензионного ключа")

    try:
        payload_bytes = _b64url_decode(parts[0])
        signature = _b64url_decode(parts[1])
    except Exception as exc:
        raise LicenseValidationError(f"Не удалось декодировать ключ: {exc}") from exc

    public_key = load_public_key()
    try:
        public_key.verify(
            signature,
            payload_bytes,
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.MAX_LENGTH),
            hashes.SHA256(),
        )
    except InvalidSignature as exc:
        raise LicenseValidationError("Подпись лицензии неверна") from exc

    try:
        payload = json.loads(payload_bytes.decode("utf-8"))
    except Exception as exc:
        raise LicenseValidationError(f"Не удалось разобрать payload: {exc}") from exc

    for required in ("license_id", "customer_name", "edition", "modules", "issued_at", "expires_at"):
        if required not in payload:
            raise LicenseValidationError(f"В лицензии отсутствует поле {required}")

    try:
        issued_at = _parse_iso(payload["issued_at"])
        expires_at = _parse_iso(payload["expires_at"])
    except Exception as exc:
        raise LicenseValidationError(f"Неверный формат дат: {exc}") from exc

    now = datetime.now(timezone.utc)
    if issued_at > now + timedelta(hours=1):
        raise LicenseValidationError("Лицензия ещё не действительна (issued_at в будущем)")

    if expires_at + timedelta(days=GRACE_PERIOD_DAYS) < now:
        raise LicenseValidationError("Срок действия лицензии истёк (с учётом grace-периода)")

    if check_hardware:
        hw_required = payload.get("hardware_id")
        if hw_required:
            local_hw = get_or_create_instance_id()
            if hw_required != local_hw:
                raise LicenseValidationError(
                    "Лицензия выдана для другого экземпляра системы (hardware_id не совпадает)"
                )

    return payload


def install_license(db: Session, key: str, installed_by_id: Optional[Any] = None):
    """Устанавливает новую лицензию: проверяет, деактивирует старые, сохраняет в БД."""
    from backend.modules.hr.models.platform_license import PlatformLicense  # local import

    payload = verify_license_key(key)

    # Деактивируем все предыдущие активные лицензии
    db.query(PlatformLicense).filter(PlatformLicense.is_active == True).update(  # noqa: E712
        {"is_active": False}, synchronize_session=False
    )

    new_license = PlatformLicense(
        license_key=key.strip(),
        license_id=str(payload["license_id"]),
        customer_name=str(payload["customer_name"]),
        edition=str(payload["edition"]),
        modules=list(payload.get("modules") or []),
        features=dict(payload.get("features") or {}),
        max_users=payload.get("max_users"),
        hardware_id=payload.get("hardware_id"),
        issued_at=_parse_iso(payload["issued_at"]),
        expires_at=_parse_iso(payload["expires_at"]),
        is_active=True,
        installed_by_id=installed_by_id,
    )
    db.add(new_license)
    db.commit()
    db.refresh(new_license)

    _invalidate_license_cache()
    return new_license


def get_active_license(db: Session):
    from backend.modules.hr.models.platform_license import PlatformLicense  # local import

    return (
        db.query(PlatformLicense)
        .filter(PlatformLicense.is_active == True)  # noqa: E712
        .order_by(PlatformLicense.installed_at.desc())
        .first()
    )


def get_license_status(db: Session) -> dict[str, Any]:
    """
    Возвращает статус лицензии.

    state ∈ {"valid", "grace", "expired", "absent", "invalid"}.
    """
    license_row = get_active_license(db)
    hardware_id = get_or_create_instance_id()

    if not license_row:
        return {
            "valid": False,
            "state": "absent",
            "days_until_expiry": None,
            "license": None,
            "hardware_id": hardware_id,
        }

    now = datetime.now(timezone.utc)
    expires_at = license_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    delta = expires_at - now
    days = int(delta.total_seconds() // 86400)

    grace_until = expires_at + timedelta(days=GRACE_PERIOD_DAYS)
    if expires_at >= now:
        state, valid = "valid", True
    elif grace_until >= now:
        state, valid = "grace", True
    else:
        state, valid = "expired", False

    # Дополнительная проверка подписи (на случай если ключ повредили в БД)
    try:
        verify_license_key(license_row.license_key)
    except LicenseValidationError as exc:
        logger.warning("Активная лицензия не прошла повторную проверку: %s", exc)
        state, valid = "invalid", False

    return {
        "valid": valid,
        "state": state,
        "days_until_expiry": days,
        "license": {
            "id": str(license_row.id),
            "license_id": license_row.license_id,
            "customer_name": license_row.customer_name,
            "edition": license_row.edition,
            "modules": license_row.modules or [],
            "features": license_row.features or {},
            "max_users": license_row.max_users,
            "hardware_id": license_row.hardware_id,
            "issued_at": license_row.issued_at.isoformat(),
            "expires_at": license_row.expires_at.isoformat(),
            "installed_at": license_row.installed_at.isoformat() if license_row.installed_at else None,
            "installed_by_id": str(license_row.installed_by_id) if license_row.installed_by_id else None,
        },
        "hardware_id": hardware_id,
    }


def _invalidate_license_cache() -> None:
    try:
        from backend.core.license import license_client, redis_client

        if redis_client is None:
            return
        # Соответствует ключу LicenseClient._get_cache_key("validation")
        redis_client.delete(license_client._get_cache_key("validation"))
    except Exception as exc:  # pragma: no cover
        logger.debug("Не удалось инвалидировать redis-кэш лицензии: %s", exc)
