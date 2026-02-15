"""
Модели для модуля Документы (документооборот и согласование).
"""

from uuid import uuid4

from sqlalchemy import (
    Boolean,
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.core.database import Base


class DocumentType(Base):
    """Тип документа"""

    __tablename__ = "document_types"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    code = Column(String(100), unique=True, nullable=False)
    default_route_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("approval_routes.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    default_route = relationship("ApprovalRoute", foreign_keys=[default_route_id])
    documents = relationship("Document", back_populates="document_type")
    templates = relationship("DocumentTemplate", back_populates="document_type")


class Document(Base):
    """Документ"""

    __tablename__ = "documents"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    document_type_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("document_types.id", ondelete="SET NULL"),
        nullable=True,
    )
    template_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("document_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(30), default="draft", nullable=False)
    current_version = Column(Integer, default=1, nullable=False)
    creator_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
    )
    approval_route_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("approval_routes.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    document_type = relationship("DocumentType", back_populates="documents")
    template = relationship("DocumentTemplate")
    versions = relationship(
        "DocumentVersion",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentVersion.version.desc()",
    )
    attachments = relationship(
        "DocumentAttachment",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    comments = relationship(
        "DocumentComment",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="DocumentComment.created_at.desc()",
    )
    approval_route = relationship("ApprovalRoute")
    approval_instances = relationship(
        "ApprovalInstance",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="ApprovalInstance.attempt.desc()",
    )


class DocumentVersion(Base):
    """Версия файла документа"""

    __tablename__ = "document_versions"
    __table_args__ = (
        UniqueConstraint("document_id", "version", name="uq_doc_version"),
    )

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    version = Column(Integer, nullable=False)
    file_path = Column(String(512), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=True)
    change_note = Column(Text, nullable=True)
    created_by = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="versions")


class DocumentAttachment(Base):
    """Дополнительное вложение к документу"""

    __tablename__ = "document_attachments"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_path = Column(String(512), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=True)
    uploaded_by = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="attachments")


class DocumentComment(Base):
    """Комментарий к документу"""

    __tablename__ = "document_comments"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
    )
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="comments")


class DocumentTemplate(Base):
    """Шаблон документа (.docx с плейсхолдерами)"""

    __tablename__ = "document_templates"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    document_type_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("document_types.id", ondelete="SET NULL"),
        nullable=True,
    )
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String(512), nullable=False)
    file_name = Column(String(255), nullable=False)
    placeholders = Column(JSONB, default=list, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    document_type = relationship("DocumentType", back_populates="templates")


class ApprovalRoute(Base):
    """Маршрут согласования"""

    __tablename__ = "approval_routes"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    steps = Column(JSONB, default=list, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ApprovalInstance(Base):
    """Экземпляр согласования (привязан к документу)"""

    __tablename__ = "approval_instances"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    route_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("approval_routes.id", ondelete="SET NULL"),
        nullable=True,
    )
    route_snapshot = Column(JSONB, nullable=True)
    status = Column(String(30), default="in_progress", nullable=False)
    current_step_order = Column(Integer, default=1, nullable=False)
    attempt = Column(Integer, default=1, nullable=False)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="approval_instances")
    route = relationship("ApprovalRoute")
    step_instances = relationship(
        "ApprovalStepInstance",
        back_populates="approval_instance",
        cascade="all, delete-orphan",
        order_by="ApprovalStepInstance.step_order",
    )


class ApprovalStepInstance(Base):
    """Решение согласующего (шаг экземпляра согласования)"""

    __tablename__ = "approval_step_instances"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    approval_instance_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("approval_instances.id", ondelete="CASCADE"),
        nullable=False,
    )
    step_order = Column(Integer, nullable=False)
    approver_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=False,
    )
    status = Column(String(30), default="pending", nullable=False)
    decision_at = Column(DateTime(timezone=True), nullable=True)
    comment = Column(Text, nullable=True)
    deadline_at = Column(DateTime(timezone=True), nullable=True)
    carry_over = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    approval_instance = relationship(
        "ApprovalInstance", back_populates="step_instances"
    )
