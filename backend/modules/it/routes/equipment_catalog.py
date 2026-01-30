"""Роуты /it/equipment-catalog — справочник оборудования (марки, типы, модели, характеристики, расходники)."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from backend.modules.it.dependencies import get_db, get_current_user, require_it_roles
from backend.modules.it.models import (
    Brand, EquipmentType, EquipmentModel, ModelSpecification, ModelConsumable, Consumable
)
from backend.modules.it.schemas.equipment_catalog import (
    BrandCreate, BrandOut, BrandUpdate,
    EquipmentTypeCreate, EquipmentTypeOut, EquipmentTypeUpdate,
    EquipmentModelCreate, EquipmentModelOut, EquipmentModelUpdate, EquipmentModelWithDetails,
    ModelSpecificationCreate, ModelSpecificationOut, ModelSpecificationUpdate,
    ModelConsumableCreate, ModelConsumableOut, ModelConsumableUpdate,
)
from backend.modules.hr.models.user import User


router = APIRouter(prefix="/equipment-catalog", tags=["equipment-catalog"])


# ========== BRANDS (Марки) ==========

@router.get("/brands", response_model=List[BrandOut])
def list_brands(
    db: Session = Depends(get_db),
    is_active: Optional[bool] = Query(None),
) -> List[BrandOut]:
    """Получить список марок"""
    q = db.query(Brand)
    if is_active is not None:
        q = q.filter(Brand.is_active == is_active)
    return q.order_by(Brand.name).all()


@router.post("/brands", response_model=BrandOut, status_code=201, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def create_brand(
    payload: BrandCreate,
    db: Session = Depends(get_db),
) -> BrandOut:
    """Создать марку"""
    existing = db.query(Brand).filter(Brand.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Марка с таким названием уже существует")
    
    brand = Brand(**payload.model_dump())
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand


@router.patch("/brands/{brand_id}", response_model=BrandOut, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def update_brand(
    brand_id: UUID,
    payload: BrandUpdate,
    db: Session = Depends(get_db),
) -> BrandOut:
    """Обновить марку"""
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Марка не найдена")
    
    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != brand.name:
        existing = db.query(Brand).filter(Brand.name == update_data["name"]).first()
        if existing:
            raise HTTPException(status_code=400, detail="Марка с таким названием уже существует")
    
    for k, v in update_data.items():
        setattr(brand, k, v)
    
    db.commit()
    db.refresh(brand)
    return brand


@router.delete("/brands/{brand_id}", status_code=200, dependencies=[Depends(require_it_roles(["admin"]))])
def delete_brand(
    brand_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить марку (только admin)"""
    brand = db.query(Brand).filter(Brand.id == brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Марка не найдена")
    
    # Проверяем использование
    type_count = db.query(EquipmentType).filter(EquipmentType.brand_id == brand_id).count()
    if type_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Невозможно удалить: марка используется в {type_count} типах оборудования"
        )
    
    db.delete(brand)
    db.commit()
    return {"message": "Марка удалена"}


# ========== EQUIPMENT TYPES (Типы оборудования) ==========

@router.get("/types", response_model=List[EquipmentTypeOut])
def list_equipment_types(
    db: Session = Depends(get_db),
    brand_id: Optional[UUID] = Query(None),
    category: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
) -> List[EquipmentTypeOut]:
    """Получить список типов оборудования"""
    q = db.query(EquipmentType).join(Brand)
    
    if brand_id:
        q = q.filter(EquipmentType.brand_id == brand_id)
    if category:
        q = q.filter(EquipmentType.category == category)
    if is_active is not None:
        q = q.filter(EquipmentType.is_active == is_active)
    
    results = q.all()
    # Добавляем brand_name через relationship
    for r in results:
        r.brand_name = r.brand.name if r.brand else None
    
    return results


@router.post("/types", response_model=EquipmentTypeOut, status_code=201, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def create_equipment_type(
    payload: EquipmentTypeCreate,
    db: Session = Depends(get_db),
) -> EquipmentTypeOut:
    """Создать тип оборудования"""
    # Проверяем существование марки
    brand = db.query(Brand).filter(Brand.id == payload.brand_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Марка не найдена")
    
    # Проверяем уникальность
    existing = db.query(EquipmentType).filter(
        EquipmentType.brand_id == payload.brand_id,
        EquipmentType.name == payload.name,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Тип с таким названием уже существует для этой марки")
    
    eq_type = EquipmentType(**payload.model_dump())
    db.add(eq_type)
    db.commit()
    db.refresh(eq_type)
    eq_type.brand_name = brand.name
    return eq_type


@router.patch("/types/{type_id}", response_model=EquipmentTypeOut, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def update_equipment_type(
    type_id: UUID,
    payload: EquipmentTypeUpdate,
    db: Session = Depends(get_db),
) -> EquipmentTypeOut:
    """Обновить тип оборудования"""
    eq_type = db.query(EquipmentType).filter(EquipmentType.id == type_id).first()
    if not eq_type:
        raise HTTPException(status_code=404, detail="Тип оборудования не найден")
    
    update_data = payload.model_dump(exclude_unset=True)
    
    # Проверка уникальности при изменении названия
    if "name" in update_data and update_data["name"] != eq_type.name:
        existing = db.query(EquipmentType).filter(
            EquipmentType.brand_id == eq_type.brand_id,
            EquipmentType.name == update_data["name"],
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Тип с таким названием уже существует для этой марки")
    
    for k, v in update_data.items():
        setattr(eq_type, k, v)
    
    db.commit()
    db.refresh(eq_type)
    eq_type.brand_name = eq_type.brand.name if eq_type.brand else None
    return eq_type


@router.delete("/types/{type_id}", status_code=200, dependencies=[Depends(require_it_roles(["admin"]))])
def delete_equipment_type(
    type_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить тип оборудования (только admin)"""
    eq_type = db.query(EquipmentType).filter(EquipmentType.id == type_id).first()
    if not eq_type:
        raise HTTPException(status_code=404, detail="Тип оборудования не найден")
    
    # Проверяем использование
    model_count = db.query(EquipmentModel).filter(EquipmentModel.equipment_type_id == type_id).count()
    if model_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Невозможно удалить: тип используется в {model_count} моделях"
        )
    
    db.delete(eq_type)
    db.commit()
    return {"message": "Тип оборудования удален"}


# ========== EQUIPMENT MODELS (Модели) ==========

@router.get("/models", response_model=List[EquipmentModelOut])
def list_equipment_models(
    db: Session = Depends(get_db),
    equipment_type_id: Optional[UUID] = Query(None),
    brand_id: Optional[UUID] = Query(None),
    category: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
) -> List[EquipmentModelOut]:
    """Получить список моделей оборудования"""
    q = db.query(EquipmentModel).join(EquipmentType).join(Brand)
    
    if equipment_type_id:
        q = q.filter(EquipmentModel.equipment_type_id == equipment_type_id)
    if brand_id:
        q = q.join(EquipmentType).filter(EquipmentType.brand_id == brand_id)
    if category:
        q = q.join(EquipmentType).filter(EquipmentType.category == category)
    if is_active is not None:
        q = q.filter(EquipmentModel.is_active == is_active)
    
    results = q.all()
    # Добавляем связанные данные
    for r in results:
        if r.equipment_type:
            r.type_name = r.equipment_type.name
            r.category = r.equipment_type.category
            if r.equipment_type.brand:
                r.brand_name = r.equipment_type.brand.name
    
    return results


@router.get("/models/{model_id}", response_model=EquipmentModelWithDetails)
def get_equipment_model(
    model_id: UUID,
    db: Session = Depends(get_db),
) -> EquipmentModelWithDetails:
    """Получить модель оборудования с характеристиками и расходниками"""
    model = db.query(EquipmentModel).options(
        joinedload(EquipmentModel.specifications),
        joinedload(EquipmentModel.consumables),
    ).filter(EquipmentModel.id == model_id).first()
    
    if not model:
        raise HTTPException(status_code=404, detail="Модель оборудования не найдена")
    
    # Формируем ответ
    result = EquipmentModelWithDetails(
        id=model.id,
        equipment_type_id=model.equipment_type_id,
        name=model.name,
        model_number=model.model_number,
        description=model.description,
        image_url=model.image_url,
        zabbix_template_id=model.zabbix_template_id,
        is_active=model.is_active,
        created_at=model.created_at,
        updated_at=model.updated_at,
        brand_name=model.equipment_type.brand.name if model.equipment_type and model.equipment_type.brand else None,
        type_name=model.equipment_type.name if model.equipment_type else None,
        category=model.equipment_type.category if model.equipment_type else None,
        specifications=[ModelSpecificationOut.model_validate(s) for s in model.specifications],
        consumables=[ModelConsumableOut.model_validate(c) for c in model.consumables],
    )
    
    return result


@router.post("/models", response_model=EquipmentModelOut, status_code=201, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def create_equipment_model(
    payload: EquipmentModelCreate,
    db: Session = Depends(get_db),
) -> EquipmentModelOut:
    """Создать модель оборудования"""
    # Проверяем существование типа
    eq_type = db.query(EquipmentType).filter(EquipmentType.id == payload.equipment_type_id).first()
    if not eq_type:
        raise HTTPException(status_code=404, detail="Тип оборудования не найден")
    
    # Проверяем уникальность
    existing = db.query(EquipmentModel).filter(
        EquipmentModel.equipment_type_id == payload.equipment_type_id,
        EquipmentModel.name == payload.name,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Модель с таким названием уже существует для этого типа")
    
    model = EquipmentModel(**payload.model_dump())
    db.add(model)
    db.commit()
    db.refresh(model)
    
    # Добавляем связанные данные
    model.type_name = eq_type.name
    model.category = eq_type.category
    model.brand_name = eq_type.brand.name if eq_type.brand else None
    
    return model


@router.patch("/models/{model_id}", response_model=EquipmentModelOut, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def update_equipment_model(
    model_id: UUID,
    payload: EquipmentModelUpdate,
    db: Session = Depends(get_db),
) -> EquipmentModelOut:
    """Обновить модель оборудования"""
    model = db.query(EquipmentModel).filter(EquipmentModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Модель оборудования не найдена")
    
    update_data = payload.model_dump(exclude_unset=True)
    
    # Проверка уникальности при изменении названия
    if "name" in update_data and update_data["name"] != model.name:
        existing = db.query(EquipmentModel).filter(
            EquipmentModel.equipment_type_id == model.equipment_type_id,
            EquipmentModel.name == update_data["name"],
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Модель с таким названием уже существует для этого типа")
    
    for k, v in update_data.items():
        setattr(model, k, v)
    
    db.commit()
    db.refresh(model)
    
    # Добавляем связанные данные
    if model.equipment_type:
        model.type_name = model.equipment_type.name
        model.category = model.equipment_type.category
        if model.equipment_type.brand:
            model.brand_name = model.equipment_type.brand.name
    
    return model


@router.delete("/models/{model_id}", status_code=200, dependencies=[Depends(require_it_roles(["admin"]))])
def delete_equipment_model(
    model_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить модель оборудования (только admin)"""
    model = db.query(EquipmentModel).filter(EquipmentModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Модель оборудования не найдена")
    
    # Проверяем использование в оборудовании
    from backend.modules.it.models import Equipment
    equipment_count = db.query(Equipment).filter(Equipment.model_id == model_id).count()
    if equipment_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Невозможно удалить: модель используется в {equipment_count} единицах оборудования"
        )
    
    db.delete(model)
    db.commit()
    return {"message": "Модель оборудования удалена"}


# ========== MODEL SPECIFICATIONS (Характеристики модели) ==========

@router.get("/models/{model_id}/specifications", response_model=List[ModelSpecificationOut])
def list_model_specifications(
    model_id: UUID,
    db: Session = Depends(get_db),
) -> List[ModelSpecificationOut]:
    """Получить характеристики модели"""
    model = db.query(EquipmentModel).filter(EquipmentModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Модель оборудования не найдена")
    
    specs = db.query(ModelSpecification).filter(
        ModelSpecification.model_id == model_id
    ).order_by(ModelSpecification.sort_order, ModelSpecification.spec_key).all()
    
    return specs


@router.post("/models/{model_id}/specifications", response_model=ModelSpecificationOut, status_code=201, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def create_model_specification(
    model_id: UUID,
    payload: ModelSpecificationCreate,
    db: Session = Depends(get_db),
) -> ModelSpecificationOut:
    """Добавить характеристику модели"""
    model = db.query(EquipmentModel).filter(EquipmentModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Модель оборудования не найдена")
    
    # Проверяем уникальность ключа
    existing = db.query(ModelSpecification).filter(
        ModelSpecification.model_id == model_id,
        ModelSpecification.spec_key == payload.spec_key,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Характеристика с таким ключом уже существует")
    
    spec = ModelSpecification(model_id=model_id, **payload.model_dump(exclude={"model_id"}))
    db.add(spec)
    db.commit()
    db.refresh(spec)
    return spec


@router.patch("/specifications/{spec_id}", response_model=ModelSpecificationOut, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def update_model_specification(
    spec_id: UUID,
    payload: ModelSpecificationUpdate,
    db: Session = Depends(get_db),
) -> ModelSpecificationOut:
    """Обновить характеристику модели"""
    spec = db.query(ModelSpecification).filter(ModelSpecification.id == spec_id).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Характеристика не найдена")
    
    update_data = payload.model_dump(exclude_unset=True)
    
    # Проверка уникальности при изменении ключа
    if "spec_key" in update_data and update_data["spec_key"] != spec.spec_key:
        existing = db.query(ModelSpecification).filter(
            ModelSpecification.model_id == spec.model_id,
            ModelSpecification.spec_key == update_data["spec_key"],
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Характеристика с таким ключом уже существует")
    
    for k, v in update_data.items():
        setattr(spec, k, v)
    
    db.commit()
    db.refresh(spec)
    return spec


@router.delete("/specifications/{spec_id}", status_code=200, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def delete_model_specification(
    spec_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить характеристику модели"""
    spec = db.query(ModelSpecification).filter(ModelSpecification.id == spec_id).first()
    if not spec:
        raise HTTPException(status_code=404, detail="Характеристика не найдена")
    
    db.delete(spec)
    db.commit()
    return {"message": "Характеристика удалена"}


# ========== MODEL CONSUMABLES (Расходные материалы модели) ==========

@router.get("/models/{model_id}/consumables", response_model=List[ModelConsumableOut])
def list_model_consumables(
    model_id: UUID,
    db: Session = Depends(get_db),
) -> List[ModelConsumableOut]:
    """Получить расходные материалы модели"""
    model = db.query(EquipmentModel).filter(EquipmentModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Модель оборудования не найдена")
    
    consumables = db.query(ModelConsumable).filter(
        ModelConsumable.model_id == model_id,
        ModelConsumable.is_active == True,
    ).order_by(ModelConsumable.name).all()
    
    return consumables


@router.post("/models/{model_id}/consumables", response_model=ModelConsumableOut, status_code=201, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def create_model_consumable(
    model_id: UUID,
    payload: ModelConsumableCreate,
    db: Session = Depends(get_db),
) -> ModelConsumableOut:
    """Добавить расходный материал модели"""
    model = db.query(EquipmentModel).filter(EquipmentModel.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Модель оборудования не найдена")
    
    # Проверяем уникальность названия
    existing = db.query(ModelConsumable).filter(
        ModelConsumable.model_id == model_id,
        ModelConsumable.name == payload.name,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Расходный материал с таким названием уже существует для этой модели")
    
    # Если указан consumable_id, проверяем его существование
    if payload.consumable_id:
        consumable = db.query(Consumable).filter(Consumable.id == payload.consumable_id).first()
        if not consumable:
            raise HTTPException(status_code=404, detail="Расходный материал не найден")
    
    # Создаем расходный материал в справочнике, если его нет
    consumable_id = payload.consumable_id
    if not consumable_id and payload.name:
        # Проверяем, существует ли расходник с таким названием
        existing_consumable = db.query(Consumable).filter(Consumable.name == payload.name).first()
        if not existing_consumable:
            # Создаем новый расходник в справочнике
            new_consumable = Consumable(
                name=payload.name,
                model=payload.part_number or None,
                category=payload.consumable_type or None,
                consumable_type=payload.consumable_type or None,
                quantity_in_stock=0,
                min_quantity=0,
            )
            db.add(new_consumable)
            db.flush()  # Получаем ID без коммита
            consumable_id = new_consumable.id
    
    model_consumable = ModelConsumable(
        model_id=model_id,
        consumable_id=consumable_id,
        **payload.model_dump(exclude={"model_id", "consumable_id"}),
    )
    db.add(model_consumable)
    db.commit()
    db.refresh(model_consumable)
    return model_consumable


@router.patch("/consumables/{consumable_id}", response_model=ModelConsumableOut, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def update_model_consumable(
    consumable_id: UUID,
    payload: ModelConsumableUpdate,
    db: Session = Depends(get_db),
) -> ModelConsumableOut:
    """Обновить расходный материал модели"""
    model_consumable = db.query(ModelConsumable).filter(ModelConsumable.id == consumable_id).first()
    if not model_consumable:
        raise HTTPException(status_code=404, detail="Расходный материал модели не найден")
    
    update_data = payload.model_dump(exclude_unset=True)
    
    # Проверка уникальности при изменении названия
    if "name" in update_data and update_data["name"] != model_consumable.name:
        existing = db.query(ModelConsumable).filter(
            ModelConsumable.model_id == model_consumable.model_id,
            ModelConsumable.name == update_data["name"],
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Расходный материал с таким названием уже существует для этой модели")
    
    for k, v in update_data.items():
        setattr(model_consumable, k, v)
    
    db.commit()
    db.refresh(model_consumable)
    return model_consumable


@router.delete("/consumables/{consumable_id}", status_code=200, dependencies=[Depends(require_it_roles(["admin", "it_specialist"]))])
def delete_model_consumable(
    consumable_id: UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Удалить расходный материал модели"""
    model_consumable = db.query(ModelConsumable).filter(ModelConsumable.id == consumable_id).first()
    if not model_consumable:
        raise HTTPException(status_code=404, detail="Расходный материал модели не найден")
    
    db.delete(model_consumable)
    db.commit()
    return {"message": "Расходный материал модели удален"}
