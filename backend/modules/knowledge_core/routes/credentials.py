from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.modules.hr.models.user import User
from backend.modules.it.dependencies import get_current_user, get_db, require_it_roles
from backend.modules.knowledge_core.models import Credential, CredentialAccessLog
from backend.modules.knowledge_core.schemas import (
    CredentialCreate,
    CredentialListItem,
    CredentialRevealRequest,
    CredentialRevealResponse,
)
from backend.modules.knowledge_core.services.crypto import decrypt_secret, encrypt_secret


router = APIRouter(prefix="/credentials", tags=["knowledge"])


def _log_access(
    db: Session,
    credential_id: UUID,
    user_id: Optional[UUID],
    action: str,
    success: bool,
) -> None:
    db.add(
        CredentialAccessLog(
            credential_id=credential_id,
            user_id=user_id,
            action=action,
            success=success,
        )
    )
    db.commit()


@router.get(
    "/",
    response_model=List[CredentialListItem],
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def list_credentials(
    db: Session = Depends(get_db),
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[UUID] = Query(None),
) -> List[Credential]:
    q = db.query(Credential)
    if entity_type:
        q = q.filter(Credential.entity_type == entity_type)
    if entity_id:
        q = q.filter(Credential.entity_id == entity_id)
    q = q.order_by(Credential.created_at.desc())
    return q.all()


@router.post(
    "/",
    response_model=CredentialListItem,
    status_code=201,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def create_credential(
    payload: CredentialCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Credential:
    salt, nonce, ciphertext = encrypt_secret(payload.master_password, payload.secret)
    packed = Credential.pack_encrypted(salt, nonce, ciphertext)
    c = Credential(
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        username=payload.username,
        encrypted_secret=packed,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    _log_access(db, c.id, user.id, "create", True)
    return c


@router.post(
    "/{credential_id}/reveal",
    response_model=CredentialRevealResponse,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def reveal_credential(
    credential_id: UUID,
    payload: CredentialRevealRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> CredentialRevealResponse:
    c = db.query(Credential).filter(Credential.id == credential_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Credentials не найдены")

    try:
        salt, nonce, ciphertext = Credential.unpack_encrypted(c.encrypted_secret)
        secret = decrypt_secret(payload.master_password, salt, nonce, ciphertext)
        _log_access(db, c.id, user.id, "reveal", True)
        return CredentialRevealResponse(
            id=c.id,
            entity_type=c.entity_type,
            entity_id=c.entity_id,
            username=c.username,
            secret=secret,
        )
    except Exception:
        _log_access(db, c.id, user.id, "reveal", False)
        raise HTTPException(status_code=403, detail="Неверный мастер-пароль")


@router.delete(
    "/{credential_id}",
    status_code=204,
    dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))],
)
def delete_credential(
    credential_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    c = db.query(Credential).filter(Credential.id == credential_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Credentials не найдены")
    _log_access(db, c.id, user.id, "delete", True)
    db.delete(c)
    db.commit()
    return None

