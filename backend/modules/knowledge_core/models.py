import base64
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID as PGUUID
from sqlalchemy.orm import relationship

from backend.core.database import Base


class KnowledgeArticle(Base):
    """
    Статья базы знаний (Knowledge Core).

    Статусы:
    - draft: черновик (ручное создание)
    - unprocessed: создано из тикета / не нормализовано
    - normalized: подтверждено пользователем
    - archived: архив
    """

    __tablename__ = "knowledge_articles"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    title = Column(String(255), nullable=False)

    status = Column(String(32), nullable=False, default="draft")
    source = Column(String(32), nullable=False, default="manual")  # manual | ticket

    raw_content = Column(Text, nullable=True)
    normalized_content = Column(Text, nullable=True)
    normalization_version = Column(Integer, nullable=False, default=0)
    normalized_by = Column(String(16), nullable=True)  # llm | user

    created_from_ticket_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="SET NULL"),
        nullable=True,
    )

    equipment_ids = Column(ARRAY(PGUUID(as_uuid=True)), nullable=False, default=list)
    linked_article_ids = Column(
        ARRAY(PGUUID(as_uuid=True)), nullable=False, default=list
    )

    confidence_score = Column(Integer, nullable=False, default=0)

    # Полезное расширение под UI "Типовое решение" из тикета
    is_typical = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    created_from_ticket = relationship("Ticket", foreign_keys=[created_from_ticket_id])


class NetworkDevice(Base):
    __tablename__ = "knowledge_network_devices"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    model = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class PhysicalServer(Base):
    __tablename__ = "knowledge_physical_servers"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    model = Column(String(255), nullable=True)
    network_device_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("knowledge_network_devices.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    network_device = relationship("NetworkDevice", foreign_keys=[network_device_id])


class VirtualServer(Base):
    __tablename__ = "knowledge_virtual_servers"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    host_physical_server_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("knowledge_physical_servers.id", ondelete="SET NULL"),
        nullable=True,
    )
    os = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    host_physical_server = relationship(
        "PhysicalServer", foreign_keys=[host_physical_server_id]
    )


class Service(Base):
    __tablename__ = "knowledge_services"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    virtual_server_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("knowledge_virtual_servers.id", ondelete="SET NULL"),
        nullable=True,
    )
    type = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    virtual_server = relationship("VirtualServer", foreign_keys=[virtual_server_id])


class Credential(Base):
    """
    Учетные данные (secret зашифрован AES-256-GCM).

    Важно: мастер-пароль НЕ хранится.
    encrypted_secret хранит формат:
      v1:<b64(salt)>:<b64(nonce)>:<b64(ciphertext)>
    """

    __tablename__ = "knowledge_credentials"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    entity_type = Column(String(64), nullable=False)
    entity_id = Column(PGUUID(as_uuid=True), nullable=False)
    username = Column(String(255), nullable=True)
    encrypted_secret = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    @staticmethod
    def pack_encrypted(salt: bytes, nonce: bytes, ciphertext: bytes) -> str:
        return "v1:" + ":".join(
            [
                base64.b64encode(salt).decode("ascii"),
                base64.b64encode(nonce).decode("ascii"),
                base64.b64encode(ciphertext).decode("ascii"),
            ]
        )

    @staticmethod
    def unpack_encrypted(value: str) -> tuple[bytes, bytes, bytes]:
        parts = (value or "").split(":")
        if len(parts) != 4 or parts[0] != "v1":
            raise ValueError("Неверный формат encrypted_secret")
        salt = base64.b64decode(parts[1].encode("ascii"))
        nonce = base64.b64decode(parts[2].encode("ascii"))
        ciphertext = base64.b64decode(parts[3].encode("ascii"))
        return salt, nonce, ciphertext


class CredentialAccessLog(Base):
    """Лог всех обращений к учетным данным (включая неуспешные)."""

    __tablename__ = "knowledge_credentials_access_log"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    credential_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("knowledge_credentials.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String(32), nullable=False)  # create | reveal | update | delete | list
    success = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    credential = relationship("Credential", foreign_keys=[credential_id])


class LLMRequestLog(Base):
    """Логирование всех LLM-запросов (Этап 1: только нормализация)."""

    __tablename__ = "knowledge_llm_request_log"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    kind = Column(String(64), nullable=False)  # e.g. knowledge_normalization
    model = Column(String(255), nullable=True)
    request_text = Column(Text, nullable=False)
    response_text = Column(Text, nullable=True)
    success = Column(Boolean, nullable=False, default=False)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KnowledgeArticleIndex(Base):
    """Служебная таблица индексации статей в Qdrant."""

    __tablename__ = "knowledge_article_index"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    article_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("knowledge_articles.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    embedding_model = Column(String(255), nullable=False)
    qdrant_collection = Column(String(255), nullable=False)
    content_hash = Column(String(64), nullable=False)
    indexed_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class KnowledgeArticleFeedback(Base):
    """Feedback по статьям (Этап 2)."""

    __tablename__ = "knowledge_article_feedback"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    article_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("knowledge_articles.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    helped = Column(Boolean, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class KnowledgeTicketSuggestionLog(Base):
    """Лог подсказок по тикетам (запрос/ответ + список статей)."""

    __tablename__ = "knowledge_ticket_suggestion_log"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    ticket_id = Column(PGUUID(as_uuid=True), ForeignKey("tickets.id"), nullable=False)
    query_text = Column(Text, nullable=False)
    embedding_model = Column(String(255), nullable=True)
    chat_model = Column(String(255), nullable=True)
    qdrant_collection = Column(String(255), nullable=True)
    found_article_ids = Column(ARRAY(PGUUID(as_uuid=True)), nullable=False, default=list)
    response_text = Column(Text, nullable=True)
    success = Column(Boolean, nullable=False, default=False)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

