"""
Схемы для иерархического справочника оборудования
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict


# Brand (Марка)
class BrandBase(BaseModel):
    name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool = True


class BrandCreate(BrandBase):
    pass


class BrandUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: Optional[bool] = None


class BrandOut(BrandBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# EquipmentType (Тип оборудования)
class EquipmentTypeBase(BaseModel):
    brand_id: UUID
    name: str
    category: str
    description: Optional[str] = None
    zabbix_template_id: Optional[str] = None
    is_active: bool = True


class EquipmentTypeCreate(EquipmentTypeBase):
    pass


class EquipmentTypeUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    zabbix_template_id: Optional[str] = None
    is_active: Optional[bool] = None


class EquipmentTypeOut(EquipmentTypeBase):
    id: UUID
    brand_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# EquipmentModel (Модель)
class EquipmentModelBase(BaseModel):
    equipment_type_id: UUID
    name: str
    model_number: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    zabbix_template_id: Optional[str] = None
    is_active: bool = True


class EquipmentModelCreate(EquipmentModelBase):
    pass


class EquipmentModelUpdate(BaseModel):
    name: Optional[str] = None
    model_number: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    zabbix_template_id: Optional[str] = None
    is_active: Optional[bool] = None


class EquipmentModelOut(EquipmentModelBase):
    id: UUID
    brand_name: Optional[str] = None
    type_name: Optional[str] = None
    category: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ModelSpecification (Характеристика модели)
class ModelSpecificationBase(BaseModel):
    model_id: UUID
    spec_key: str
    spec_value: str
    spec_unit: Optional[str] = None
    sort_order: int = 0


class ModelSpecificationCreate(ModelSpecificationBase):
    pass


class ModelSpecificationUpdate(BaseModel):
    spec_key: Optional[str] = None
    spec_value: Optional[str] = None
    spec_unit: Optional[str] = None
    sort_order: Optional[int] = None


class ModelSpecificationOut(ModelSpecificationBase):
    id: UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# ModelConsumable (Расходный материал модели)
class ModelConsumableBase(BaseModel):
    consumable_id: Optional[UUID] = None
    name: str
    consumable_type: Optional[str] = None
    part_number: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class ModelConsumableCreate(ModelConsumableBase):
    pass


class ModelConsumableUpdate(BaseModel):
    name: Optional[str] = None
    consumable_type: Optional[str] = None
    part_number: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ModelConsumableOut(ModelConsumableBase):
    id: UUID
    model_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# Иерархические представления для удобства
class EquipmentModelWithDetails(EquipmentModelOut):
    specifications: List[ModelSpecificationOut] = []
    consumables: List[ModelConsumableOut] = []


class EquipmentTypeWithModels(EquipmentTypeOut):
    models: List[EquipmentModelOut] = []


class BrandWithTypes(BrandOut):
    equipment_types: List[EquipmentTypeOut] = []
