from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def log_action(db: Session, user: str, action: str, entity: str, details: str | None = None) -> None:
    db.add(AuditLog(user=user, action=action, entity=entity, details=details))
    db.commit()
