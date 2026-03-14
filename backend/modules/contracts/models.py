"""
Модели модуля Договора (учёт договоров и актов, интеграция с документооборотом).
"""

from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import backref, relationship
from sqlalchemy.sql import func

from backend.core.database import Base


class Counterparty(Base):
    """Контрагент (firms)."""

    __tablename__ = "contract_counterparties"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    legacy_num = Column(Integer, unique=True, nullable=True, index=True)  # для миграции из docs
    name = Column(String(255), nullable=False)
    full_name = Column(String(500), nullable=True)
    inn = Column(String(20), nullable=True, index=True)
    kpp = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    contracts = relationship("Contract", back_populates="counterparty")


class ContractType(Base):
    """Тип договора (dogtypes)."""

    __tablename__ = "contract_types"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    legacy_num = Column(Integer, unique=True, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    contracts = relationship("Contract", back_populates="contract_type")


class Funding(Base):
    """Источник финансирования (funding)."""

    __tablename__ = "contract_funding"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    legacy_num = Column(Integer, unique=True, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contracts = relationship("Contract", back_populates="funding")


class CostCode(Base):
    """Шифр затрат (shifrs)."""

    __tablename__ = "contract_cost_codes"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    legacy_num = Column(Integer, unique=True, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contracts = relationship("Contract", back_populates="cost_code")


class Subunit(Base):
    """Подразделение (subunits)."""

    __tablename__ = "contract_subunits"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    legacy_id = Column(Integer, unique=True, nullable=True, index=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contracts = relationship("Contract", back_populates="subunit")


class Contract(Base):
    """Договор (dogs). Связь с документом: после согласования можно «отправить в договора»."""

    __tablename__ = "contracts"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    legacy_num = Column(Integer, unique=True, nullable=True, index=True)

    # Связь с документом: если договор создан из согласованного документа
    document_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    contract_type_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("contract_types.id", ondelete="SET NULL"),
        nullable=True,
    )
    counterparty_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("contract_counterparties.id", ondelete="SET NULL"),
        nullable=True,
    )
    funding_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("contract_funding.id", ondelete="SET NULL"),
        nullable=True,
    )
    cost_code_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("contract_cost_codes.id", ondelete="SET NULL"),
        nullable=True,
    )
    subunit_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("contract_subunits.id", ondelete="SET NULL"),
        nullable=True,
    )

    number = Column(String(100), nullable=False, index=True)
    date_begin = Column(Date, nullable=True)
    date_end = Column(Date, nullable=True)
    name = Column(String(500), nullable=False)
    full_name = Column(Text, nullable=True)
    inv_num = Column(String(100), nullable=True)
    comment = Column(Text, nullable=True)
    sum_amount = Column(Numeric(15, 2), default=0, nullable=False)
    notice = Column(Text, nullable=True)
    term = Column(Date, nullable=True)  # срок завершения
    done = Column(Boolean, default=False, nullable=False)

    created_by_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    document = relationship(
        "Document",
        backref=backref("contracts", lazy="dynamic"),
    )
    contract_type = relationship("ContractType", back_populates="contracts")
    counterparty = relationship("Counterparty", back_populates="contracts")
    funding = relationship("Funding", back_populates="contracts")
    cost_code = relationship("CostCode", back_populates="contracts")
    subunit = relationship("Subunit", back_populates="contracts")
    acts = relationship(
        "ContractAct",
        back_populates="contract",
        cascade="all, delete-orphan",
        order_by="ContractAct.act_date",
    )
    files = relationship(
        "ContractFile",
        back_populates="contract",
        cascade="all, delete-orphan",
        foreign_keys="ContractFile.contract_id",
    )


class ContractAct(Base):
    """Акт / платёжное поручение по договору (acts). doctype: 0=акт, 1=П/П, 2=корректировка суммы."""

    __tablename__ = "contract_acts"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    legacy_num = Column(Integer, unique=True, nullable=True, index=True)

    contract_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=False,
    )
    doctype = Column(Integer, default=0, nullable=False)  # 0=акт, 1=П/П, 2=корректировка
    number = Column(String(100), nullable=True)
    act_date = Column(Date, nullable=True)
    notice = Column(Text, nullable=True)
    amount = Column(Numeric(15, 2), default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    contract = relationship("Contract", back_populates="acts")
    files = relationship(
        "ContractFile",
        back_populates="contract_act",
        cascade="all, delete-orphan",
        foreign_keys="ContractFile.contract_act_id",
    )


class ContractFile(Base):
    """Файл-оригинал: договор, акт или контрагент (src, actsrc, firmsrc)."""

    __tablename__ = "contract_files"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    contract_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("contracts.id", ondelete="CASCADE"),
        nullable=True,
    )
    contract_act_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("contract_acts.id", ondelete="CASCADE"),
        nullable=True,
    )
    counterparty_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("contract_counterparties.id", ondelete="CASCADE"),
        nullable=True,
    )
    kind = Column(String(20), nullable=False)  # contract | act | counterparty
    file_path = Column(String(512), nullable=False)
    file_name = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    contract = relationship(
        "Contract",
        back_populates="files",
        foreign_keys=[contract_id],
    )
    contract_act = relationship(
        "ContractAct",
        back_populates="files",
        foreign_keys=[contract_act_id],
    )
