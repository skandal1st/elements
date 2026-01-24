"""Схемы IT модуля."""
from .equipment import EquipmentCreate, EquipmentOut, EquipmentUpdate
from .ticket import TicketCreate, TicketOut, TicketUpdate
from .ticket_comment import TicketCommentCreate, TicketCommentOut, TicketCommentUpdate
from .equipment_history import EquipmentHistoryOut, ChangeOwnerRequest
from .consumable import ConsumableCreate, ConsumableOut, ConsumableUpdate, ConsumableIssueCreate, ConsumableIssueOut
from .equipment_request import EquipmentRequestCreate, EquipmentRequestOut, EquipmentRequestUpdate, ReviewRequest
from .license import SoftwareLicenseCreate, SoftwareLicenseOut, SoftwareLicenseUpdate, LicenseAssignmentCreate, LicenseAssignmentOut
from .dictionary import DictionaryCreate, DictionaryOut, DictionaryUpdate
from .notification import NotificationCreate, NotificationOut, NotificationListResponse, UnreadCountResponse
from .building import BuildingCreate, BuildingOut, BuildingUpdate

__all__ = [
    "EquipmentCreate",
    "EquipmentOut",
    "EquipmentUpdate",
    "TicketCreate",
    "TicketOut",
    "TicketUpdate",
    "TicketCommentCreate",
    "TicketCommentOut",
    "TicketCommentUpdate",
    "EquipmentHistoryOut",
    "ChangeOwnerRequest",
    "ConsumableCreate",
    "ConsumableOut",
    "ConsumableUpdate",
    "ConsumableIssueCreate",
    "ConsumableIssueOut",
    "EquipmentRequestCreate",
    "EquipmentRequestOut",
    "EquipmentRequestUpdate",
    "ReviewRequest",
    "SoftwareLicenseCreate",
    "SoftwareLicenseOut",
    "SoftwareLicenseUpdate",
    "LicenseAssignmentCreate",
    "LicenseAssignmentOut",
    "DictionaryCreate",
    "DictionaryOut",
    "DictionaryUpdate",
    "NotificationCreate",
    "NotificationOut",
    "NotificationListResponse",
    "UnreadCountResponse",
    "BuildingCreate",
    "BuildingOut",
    "BuildingUpdate",
]
