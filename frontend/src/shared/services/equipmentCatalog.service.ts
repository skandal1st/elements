import { apiGet, apiPost, apiPatch } from '../api/client'

export type Brand = {
  id: string
  name: string
  description?: string
  logo_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export type EquipmentType = {
  id: string
  brand_id: string
  name: string
  category: string
  description?: string
  zabbix_template_id?: string | null
  is_active: boolean
  brand_name?: string
  created_at: string
  updated_at: string
}

export type EquipmentModel = {
  id: string
  equipment_type_id: string
  name: string
  model_number?: string
  description?: string
  image_url?: string
  zabbix_template_id?: string | null
  is_active: boolean
  brand_name?: string
  type_name?: string
  category?: string
  created_at: string
  updated_at: string
  specifications?: ModelSpecification[]
  consumables?: ModelConsumable[]
}

export type ModelSpecification = {
  id: string
  model_id: string
  spec_key: string
  spec_value: string
  spec_unit?: string
  sort_order: number
  created_at: string
}

export type ModelConsumable = {
  id: string
  model_id: string
  consumable_id?: string
  name: string
  consumable_type?: string
  part_number?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const equipmentCatalogService = {
  async getBrands(): Promise<Brand[]> {
    return apiGet<Brand[]>('/it/equipment-catalog/brands')
  },

  async createBrand(data: { name: string; description?: string; logo_url?: string }): Promise<Brand> {
    return apiPost<Brand>('/it/equipment-catalog/brands', data)
  },

  async getEquipmentTypes(brandId?: string, category?: string): Promise<EquipmentType[]> {
    const params = new URLSearchParams()
    if (brandId) params.set('brand_id', brandId)
    if (category) params.set('category', category)
    return apiGet<EquipmentType[]>(`/it/equipment-catalog/types?${params}`)
  },

  async createEquipmentType(data: { brand_id: string; name: string; category: string; description?: string; zabbix_template_id?: string | null }): Promise<EquipmentType> {
    return apiPost<EquipmentType>('/it/equipment-catalog/types', data)
  },

  async updateEquipmentType(typeId: string, data: { name?: string; category?: string; description?: string; zabbix_template_id?: string | null; is_active?: boolean }): Promise<EquipmentType> {
    return apiPatch<EquipmentType>(`/it/equipment-catalog/types/${typeId}`, data)
  },

  async getModel(modelId: string): Promise<EquipmentModel> {
    return apiGet<EquipmentModel>(`/it/equipment-catalog/models/${modelId}`)
  },

  async getModels(equipmentTypeId?: string, brandId?: string, category?: string): Promise<EquipmentModel[]> {
    const params = new URLSearchParams()
    if (equipmentTypeId) params.set('equipment_type_id', equipmentTypeId)
    if (brandId) params.set('brand_id', brandId)
    if (category) params.set('category', category)
    return apiGet<EquipmentModel[]>(`/it/equipment-catalog/models?${params}`)
  },

  async createModel(data: {
    equipment_type_id: string
    name: string
    model_number?: string
    description?: string
    zabbix_template_id?: string | null
  }): Promise<EquipmentModel> {
    return apiPost<EquipmentModel>('/it/equipment-catalog/models', data)
  },

  async updateEquipmentModel(modelId: string, data: { name?: string; model_number?: string; description?: string; image_url?: string; zabbix_template_id?: string | null; is_active?: boolean }): Promise<EquipmentModel> {
    return apiPatch<EquipmentModel>(`/it/equipment-catalog/models/${modelId}`, data)
  },

  /** Список шаблонов Zabbix для привязки к типу/модели (требуются права IT) */
  async getZabbixTemplates(search?: string): Promise<{ templateid: string; name: string; host: string }[]> {
    const params = search ? `?search=${encodeURIComponent(search)}` : ''
    return apiGet<{ templateid: string; name: string; host: string }[]>(`/it/zabbix/templates${params}`)
  },

  async getModelConsumables(modelId: string): Promise<ModelConsumable[]> {
    return apiGet<ModelConsumable[]>(`/it/equipment-catalog/models/${modelId}/consumables`)
  },

  async createModelConsumable(modelId: string, data: {
    name: string
    consumable_type?: string
    part_number?: string
    description?: string
  }): Promise<ModelConsumable> {
    return apiPost<ModelConsumable>(`/it/equipment-catalog/models/${modelId}/consumables`, data)
  },
}
