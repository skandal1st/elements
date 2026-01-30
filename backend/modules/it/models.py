"""
Модели для IT модуля
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    DECIMAL,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from backend.core.database import Base


class Building(Base):
    """Здание"""

    __tablename__ = "buildings"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), unique=True, nullable=False)
    address = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    rooms = relationship(
        "Room", back_populates="building", cascade="all, delete-orphan"
    )


class Room(Base):
    """Кабинет (комната) в здании"""

    __tablename__ = "rooms"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    building_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("buildings.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String(255), nullable=False)  # Номер/название кабинета
    floor = Column(Integer, nullable=True)  # Этаж
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    building = relationship("Building", back_populates="rooms")
    equipment_items = relationship(
        "Equipment", foreign_keys="Equipment.room_id", back_populates="room"
    )
    # employees relationship - односторонняя, так как Employee в другом модуле
    tickets = relationship(
        "Ticket", foreign_keys="Ticket.room_id", back_populates="room"
    )

    __table_args__ = (
        UniqueConstraint("building_id", "name", name="unique_building_room"),
    )


class Equipment(Base):
    """Оборудование"""

    __tablename__ = "equipment"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    model_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment_models.id", ondelete="SET NULL"),
        nullable=True,
    )  # Связь со справочником моделей
    model = Column(String(255), nullable=True)  # Оставляем для обратной совместимости
    inventory_number = Column(String(255), unique=True, nullable=False)
    serial_number = Column(String(255), nullable=True)
    category = Column(String(50), nullable=False)  # computer, monitor, printer, etc.
    status = Column(
        String(50), default="in_stock", nullable=False
    )  # in_use, in_stock, in_repair, written_off
    purchase_date = Column(Date, nullable=True)
    cost = Column(DECIMAL(10, 2), nullable=True)
    warranty_until = Column(Date, nullable=True)
    current_owner_id = Column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    room_id = Column(
        PGUUID(as_uuid=True), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True
    )  # Кабинет, где находится оборудование
    location_department = Column(
        String(255), nullable=True
    )  # Оставляем для обратной совместимости
    location_room = Column(
        String(255), nullable=True
    )  # Оставляем для обратной совместимости
    manufacturer = Column(String(255), nullable=True)
    ip_address = Column(String(50), nullable=True)
    hostname = Column(String(255), nullable=True)  # Имя компьютера в сети (для синхронизации со сканером)
    zabbix_host_id = Column(String(32), nullable=True)  # hostid в Zabbix после добавления в мониторинг
    specifications = Column(JSONB, nullable=True)
    attachments = Column(ARRAY(String), nullable=True)
    qr_code = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    owner = relationship("Employee", foreign_keys=[current_owner_id])
    model_ref = relationship("EquipmentModel", foreign_keys=[model_id])
    room = relationship("Room", foreign_keys=[room_id])


class EquipmentHistory(Base):
    """История перемещений оборудования"""

    __tablename__ = "equipment_history"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    equipment_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment.id", ondelete="CASCADE"),
        nullable=False,
    )
    from_user_id = Column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    to_user_id = Column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    from_location = Column(String(255), nullable=True)
    to_location = Column(String(255), nullable=True)
    reason = Column(Text, nullable=True)
    changed_by_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    equipment = relationship("Equipment", foreign_keys=[equipment_id])


class Ticket(Base):
    """Заявка (тикет)"""

    __tablename__ = "tickets"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(
        String(50), nullable=False
    )  # hardware, software, network, hr, other
    priority = Column(
        String(50), default="medium", nullable=False
    )  # low, medium, high, critical
    status = Column(
        String(50), default="new", nullable=False
    )  # new, in_progress, waiting, resolved, closed, pending_user
    creator_id = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )  # nullable для email-тикетов
    employee_id = Column(
        Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )  # привязка к сотруднику (HR), даже без учётной записи
    assignee_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    equipment_id = Column(
        PGUUID(as_uuid=True), ForeignKey("equipment.id"), nullable=True
    )
    room_id = Column(
        PGUUID(as_uuid=True), ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True
    )  # Кабинет, связанный с заявкой
    attachments = Column(ARRAY(String), nullable=True)
    desired_resolution_date = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    rating = Column(Integer, nullable=True)  # 1-5
    rating_comment = Column(Text, nullable=True)

    # Источник создания тикета
    source = Column(
        String(20), default="web", nullable=False
    )  # web, email, api, telegram
    email_sender = Column(
        String(255), nullable=True
    )  # Email отправителя (для незарегистрированных)
    email_message_id = Column(
        String(255), nullable=True
    )  # Message-ID для email threading

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    creator = relationship("User", foreign_keys=[creator_id])
    assignee = relationship("User", foreign_keys=[assignee_id])
    employee = relationship("Employee", foreign_keys=[employee_id])
    equipment = relationship("Equipment", foreign_keys=[equipment_id])
    room = relationship("Room", foreign_keys=[room_id])


class EmailSenderEmployeeMap(Base):
    """
    Соответствие email отправителя -> сотрудник (HR Employee).

    Нужно для email-тикетов: если один раз IT привязал "инициатора" к письму,
    последующие тикеты с этого адреса будут автоматически привязываться к сотруднику.
    """

    __tablename__ = "email_sender_employee_map"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String(255), nullable=False, unique=True)
    employee_id = Column(
        Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    employee = relationship("Employee", foreign_keys=[employee_id])


class TicketComment(Base):
    """Комментарий к заявке"""

    __tablename__ = "ticket_comments"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    ticket_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    attachments = Column(ARRAY(String), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    ticket = relationship("Ticket", foreign_keys=[ticket_id])
    user = relationship("User", foreign_keys=[user_id])


class TicketHistory(Base):
    """История изменений тикета"""

    __tablename__ = "ticket_history"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    ticket_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    changed_by_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    field = Column(String(50), nullable=False)  # Название изменённого поля
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    ticket = relationship("Ticket", foreign_keys=[ticket_id])
    changed_by = relationship("User", foreign_keys=[changed_by_id])


class TicketConsumable(Base):
    """Связь тикета с расходными материалами (использованные при решении)"""

    __tablename__ = "ticket_consumables"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    ticket_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    consumable_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("consumables.id", ondelete="CASCADE"),
        nullable=False,
    )
    quantity = Column(Integer, default=1, nullable=False)  # Количество для списания
    is_written_off = Column(Boolean, default=False, nullable=False)  # Списано со склада
    written_off_at = Column(DateTime(timezone=True), nullable=True)  # Дата списания
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    ticket = relationship("Ticket", foreign_keys=[ticket_id])
    consumable = relationship("Consumable", foreign_keys=[consumable_id])

    __table_args__ = (
        UniqueConstraint("ticket_id", "consumable_id", name="unique_ticket_consumable"),
    )


class Consumable(Base):
    """Расходный материал"""

    __tablename__ = "consumables"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    model = Column(String(255), nullable=True)
    category = Column(String(255), nullable=True)
    consumable_type = Column(
        String(50), nullable=True
    )  # cartridge, drum, toner, ink, paper, other
    unit = Column(String(50), default="шт", nullable=False)
    quantity_in_stock = Column(Integer, default=0, nullable=False)
    min_quantity = Column(Integer, default=0, nullable=False)
    cost_per_unit = Column(DECIMAL(10, 2), nullable=True)
    supplier = Column(String(255), nullable=True)
    last_purchase_date = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ConsumableIssue(Base):
    """Выдача расходного материала"""

    __tablename__ = "consumable_issues"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    consumable_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("consumables.id", ondelete="CASCADE"),
        nullable=False,
    )
    quantity = Column(Integer, nullable=False)
    issued_to_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    issued_by_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    consumable = relationship("Consumable", foreign_keys=[consumable_id])
    issued_to = relationship("User", foreign_keys=[issued_to_id])
    issued_by = relationship("User", foreign_keys=[issued_by_id])


class EquipmentRequest(Base):
    """Заявка на оборудование"""

    __tablename__ = "equipment_requests"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    equipment_category = Column(
        String(50), nullable=False
    )  # computer, monitor, printer, etc.
    request_type = Column(
        String(50), default="new", nullable=False
    )  # new, replacement, upgrade
    quantity = Column(Integer, default=1, nullable=False)
    urgency = Column(
        String(50), default="normal", nullable=False
    )  # low, normal, high, critical
    justification = Column(Text, nullable=True)
    status = Column(
        String(50), default="pending", nullable=False
    )  # pending, approved, rejected, ordered, received, issued, cancelled

    # Связи с пользователями
    requester_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reviewer_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Связи с оборудованием
    replace_equipment_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment.id", ondelete="SET NULL"),
        nullable=True,
    )
    issued_equipment_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Закупка и рассмотрение
    estimated_cost = Column(DECIMAL(12, 2), nullable=True)
    review_comment = Column(Text, nullable=True)

    # Даты
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    ordered_at = Column(DateTime(timezone=True), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    issued_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    requester = relationship("User", foreign_keys=[requester_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
    replace_equipment = relationship("Equipment", foreign_keys=[replace_equipment_id])
    issued_equipment = relationship("Equipment", foreign_keys=[issued_equipment_id])


class SoftwareLicense(Base):
    """Лицензия ПО"""

    __tablename__ = "software_licenses"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    software_name = Column(String(255), nullable=False)
    vendor = Column(String(255), nullable=True)
    license_type = Column(
        String(100), nullable=True
    )  # perpetual, subscription, trial, etc.
    license_key = Column(Text, nullable=True)
    total_licenses = Column(Integer, default=1, nullable=False)
    used_licenses = Column(Integer, default=0, nullable=False)
    expires_at = Column(Date, nullable=True)
    cost = Column(DECIMAL(10, 2), nullable=True)
    purchase_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class LicenseAssignment(Base):
    """Привязка лицензии к пользователю или оборудованию"""

    __tablename__ = "license_assignments"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    license_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("software_licenses.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    equipment_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment.id", ondelete="SET NULL"),
        nullable=True,
    )
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    released_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    license = relationship("SoftwareLicense", foreign_keys=[license_id])
    user = relationship("User", foreign_keys=[user_id])
    equipment = relationship("Equipment", foreign_keys=[equipment_id])


class Dictionary(Base):
    """Универсальный справочник"""

    __tablename__ = "dictionaries"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    dictionary_type = Column(
        String(50), nullable=False
    )  # ticket_category, ticket_priority, equipment_category, etc.
    key = Column(String(100), nullable=False)
    label = Column(String(255), nullable=False)
    color = Column(String(50), nullable=True)
    icon = Column(String(100), nullable=True)
    sort_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    __table_args__ = (
        UniqueConstraint("dictionary_type", "key", name="unique_dictionary_key"),
    )


class Notification(Base):
    """Уведомления пользователей"""

    __tablename__ = "notifications"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), nullable=False)  # info, warning, error, success
    related_type = Column(String(50), nullable=True)  # ticket, equipment, etc.
    related_id = Column(PGUUID(as_uuid=True), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", foreign_keys=[user_id])


# Иерархический справочник оборудования


class Brand(Base):
    """Марка оборудования"""

    __tablename__ = "equipment_brands"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    logo_url = Column(String(512), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    equipment_types = relationship(
        "EquipmentType", back_populates="brand", cascade="all, delete-orphan"
    )


class EquipmentType(Base):
    """Тип оборудования (в рамках марки)"""

    __tablename__ = "equipment_types"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    brand_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment_brands.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(String(255), nullable=False)  # Ноутбук, Принтер, Монитор и т.д.
    category = Column(
        String(50), nullable=False
    )  # computer, monitor, printer, etc. (из словаря)
    description = Column(Text, nullable=True)
    zabbix_template_id = Column(String(64), nullable=True)  # ID шаблона Zabbix для типа
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    brand = relationship("Brand", back_populates="equipment_types")
    models = relationship(
        "EquipmentModel", back_populates="equipment_type", cascade="all, delete-orphan"
    )

    __table_args__ = (UniqueConstraint("brand_id", "name", name="unique_brand_type"),)


class EquipmentModel(Base):
    """Модель оборудования"""

    __tablename__ = "equipment_models"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    equipment_type_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment_types.id", ondelete="CASCADE"),
        nullable=False,
    )
    name = Column(
        String(255), nullable=False
    )  # ThinkPad X1 Carbon, LaserJet Pro M404dn и т.д.
    model_number = Column(String(100), nullable=True)  # Артикул/номер модели
    description = Column(Text, nullable=True)
    image_url = Column(String(512), nullable=True)
    zabbix_template_id = Column(String(64), nullable=True)  # ID шаблона Zabbix для модели
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    equipment_type = relationship("EquipmentType", back_populates="models")
    specifications = relationship(
        "ModelSpecification", back_populates="model", cascade="all, delete-orphan"
    )
    consumables = relationship(
        "ModelConsumable", back_populates="model", cascade="all, delete-orphan"
    )
    equipment_items = relationship(
        "Equipment", foreign_keys="Equipment.model_id", back_populates="model_ref"
    )

    __table_args__ = (
        UniqueConstraint("equipment_type_id", "name", name="unique_type_model"),
    )


class ModelSpecification(Base):
    """Характеристика модели"""

    __tablename__ = "model_specifications"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    model_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment_models.id", ondelete="CASCADE"),
        nullable=False,
    )
    spec_key = Column(String(100), nullable=False)  # RAM, CPU, Display, etc.
    spec_value = Column(String(255), nullable=False)  # 16GB, Intel i7, 14" FHD и т.д.
    spec_unit = Column(String(50), nullable=True)  # GB, GHz, дюймы и т.д.
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    model = relationship("EquipmentModel", back_populates="specifications")

    __table_args__ = (
        UniqueConstraint("model_id", "spec_key", name="unique_model_spec"),
    )


class ModelConsumable(Base):
    """Расходный материал для модели"""

    __tablename__ = "model_consumables"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    model_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("equipment_models.id", ondelete="CASCADE"),
        nullable=False,
    )
    consumable_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("consumables.id", ondelete="SET NULL"),
        nullable=True,
    )  # Связь с существующим расходником
    name = Column(String(255), nullable=False)  # Название расходника
    consumable_type = Column(String(50), nullable=True)  # cartridge, toner, ink, etc.
    part_number = Column(String(100), nullable=True)  # Артикул расходника
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    model = relationship("EquipmentModel", back_populates="consumables")
    consumable = relationship("Consumable", foreign_keys=[consumable_id])

    __table_args__ = (
        UniqueConstraint("model_id", "name", name="unique_model_consumable"),
    )


class ConsumableSupply(Base):
    """Поставка расходных материалов"""

    __tablename__ = "consumable_supplies"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    consumable_id = Column(
        PGUUID(as_uuid=True),
        ForeignKey("consumables.id", ondelete="CASCADE"),
        nullable=False,
    )
    quantity = Column(Integer, nullable=False)  # Количество в поставке
    cost = Column(DECIMAL(12, 2), nullable=True)  # Общая стоимость поставки
    supplier = Column(String(255), nullable=True)  # Поставщик
    invoice_number = Column(String(100), nullable=True)  # Номер накладной
    supply_date = Column(Date, nullable=True)  # Дата поставки
    notes = Column(Text, nullable=True)  # Примечания
    created_by_id = Column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )  # Кто добавил поставку
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    consumable = relationship("Consumable", foreign_keys=[consumable_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
