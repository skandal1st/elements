import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client'

export interface Room {
  id: string
  building_id: string
  name: string
  floor?: number | null
  description?: string | null
  is_active: boolean
  building_name?: string
  created_at: string
  updated_at: string
}

export interface Building {
  id: string
  name: string
  address?: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export const roomsService = {
  async getRooms(buildingId?: string, isActive?: boolean): Promise<Room[]> {
    const params = new URLSearchParams()
    if (buildingId) params.set('building_id', buildingId)
    if (isActive !== undefined) params.set('is_active', String(isActive))
    return apiGet<Room[]>(`/it/rooms/?${params}`)
  },

  async getRoom(roomId: string): Promise<Room> {
    return apiGet<Room>(`/it/rooms/${roomId}`)
  },

  async createRoom(data: {
    building_id: string
    name: string
    floor?: number
    description?: string
    is_active?: boolean
  }): Promise<Room> {
    return apiPost<Room>('/it/rooms/', data)
  },

  async updateRoom(roomId: string, data: {
    name?: string
    floor?: number
    description?: string
    is_active?: boolean
  }): Promise<Room> {
    return apiPatch<Room>(`/it/rooms/${roomId}`, data)
  },

  async deleteRoom(roomId: string): Promise<void> {
    return apiDelete(`/it/rooms/${roomId}`)
  },

  async getRoomEquipment(roomId: string): Promise<Array<{
    id: string
    name: string
    inventory_number: string
    category: string
    status: string
    owner_name?: string
  }>> {
    return apiGet(`/it/rooms/${roomId}/equipment`)
  },
}

export const buildingsService = {
  async getBuildings(isActive?: boolean): Promise<Building[]> {
    const params = new URLSearchParams()
    if (isActive !== undefined) params.set('active', String(isActive))
    return apiGet<Building[]>(`/it/buildings/?${params}`)
  },

  async getBuilding(buildingId: string): Promise<Building> {
    return apiGet<Building>(`/it/buildings/${buildingId}`)
  },

  async createBuilding(data: {
    name: string
    address?: string
    description?: string
    is_active?: boolean
  }): Promise<Building> {
    return apiPost<Building>('/it/buildings/', data)
  },

  async updateBuilding(buildingId: string, data: {
    name?: string
    address?: string
    description?: string
    is_active?: boolean
  }): Promise<Building> {
    return apiPatch<Building>(`/it/buildings/${buildingId}`, data)
  },

  async deleteBuilding(buildingId: string): Promise<void> {
    return apiDelete(`/it/buildings/${buildingId}`)
  },
}
