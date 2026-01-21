import { get, post } from '../lib/api';
import type {
  ZabbixHost,
  ZabbixGroup,
  ZabbixTemplate,
  ZabbixEquipmentStatus,
  ZabbixEquipmentCounters,
} from '../types';

export interface ZabbixConnectionStatus {
  connected: boolean;
  version?: string;
  error?: string;
}

export const zabbixService = {
  /**
   * Проверить подключение к Zabbix
   */
  async checkConnection(): Promise<{ data: ZabbixConnectionStatus | null; error: Error | null }> {
    return get<ZabbixConnectionStatus>('/zabbix/status');
  },

  /**
   * Получить список хостов из Zabbix
   */
  async getHosts(groupId?: string): Promise<{ data: ZabbixHost[] | null; error: Error | null }> {
    const params = groupId ? `?groupId=${groupId}` : '';
    return get<ZabbixHost[]>(`/zabbix/hosts${params}`);
  },

  /**
   * Найти хост по IP адресу
   */
  async getHostByIP(ip: string): Promise<{ data: { found: boolean; host: ZabbixHost | null } | null; error: Error | null }> {
    return get<{ found: boolean; host: ZabbixHost | null }>(`/zabbix/host/${encodeURIComponent(ip)}`);
  },

  /**
   * Получить статус оборудования в Zabbix
   */
  async getEquipmentStatus(equipmentId: string): Promise<{ data: ZabbixEquipmentStatus | null; error: Error | null }> {
    return get<ZabbixEquipmentStatus>(`/zabbix/equipment/${equipmentId}/status`);
  },

  /**
   * Получить счётчики страниц принтера
   */
  async getEquipmentCounters(equipmentId: string): Promise<{ data: ZabbixEquipmentCounters | null; error: Error | null }> {
    return get<ZabbixEquipmentCounters>(`/zabbix/equipment/${equipmentId}/counters`);
  },

  /**
   * Получить группы хостов Zabbix
   */
  async getGroups(): Promise<{ data: ZabbixGroup[] | null; error: Error | null }> {
    return get<ZabbixGroup[]>('/zabbix/groups');
  },

  /**
   * Получить шаблоны Zabbix
   */
  async getTemplates(search?: string): Promise<{ data: ZabbixTemplate[] | null; error: Error | null }> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return get<ZabbixTemplate[]>(`/zabbix/templates${params}`);
  },

  /**
   * Добавить оборудование в Zabbix
   */
  async addEquipmentToZabbix(
    equipmentId: string,
    groupId: string,
    templateId?: string,
    snmpCommunity?: string
  ): Promise<{ data: { success: boolean; hostid?: string; message?: string } | null; error: Error | null }> {
    return post<{ success: boolean; hostid?: string; message?: string }>(
      `/zabbix/equipment/${equipmentId}/add`,
      {
        groupId,
        templateId,
        snmpCommunity,
      }
    );
  },
};
