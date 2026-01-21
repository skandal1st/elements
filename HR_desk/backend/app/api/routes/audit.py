from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogOut


router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/", response_model=List[AuditLogOut], dependencies=[Depends(require_roles(["auditor", "it", "hr"]))])
def list_logs(db: Session = Depends(get_db)) -> List[AuditLog]:
    return db.query(AuditLog).order_by(AuditLog.timestamp.desc()).all()
