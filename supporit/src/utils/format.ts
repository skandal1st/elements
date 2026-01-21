import { format as formatDate } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { EquipmentStatus, EquipmentCategory } from '../types';

export const formatCurrency = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null) return '-';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
  }).format(amount);
};

export const formatDateString = (dateString: string | undefined | null): string => {
  if (!dateString) return '-';
  try {
    return formatDate(new Date(dateString), 'dd.MM.yyyy', { locale: ru });
  } catch {
    return dateString;
  }
};

export const formatDateTime = (dateString: string | undefined | null): string => {
  if (!dateString) return '-';
  try {
    return formatDate(new Date(dateString), 'dd.MM.yyyy HH:mm', { locale: ru });
  } catch {
    return dateString;
  }
};

export const getStatusLabel = (status: EquipmentStatus): string => {
  const labels: Record<EquipmentStatus, string> = {
    in_use: 'В работе',
    in_stock: 'На складе',
    in_repair: 'В ремонте',
    written_off: 'Списано',
  };
  return labels[status] || status;
};

export const getStatusColor = (status: EquipmentStatus): string => {
  const colors: Record<EquipmentStatus, string> = {
    in_use: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    in_stock: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    in_repair: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    written_off: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  };
  return colors[status] || '';
};

export const getCategoryLabel = (category: EquipmentCategory): string => {
  const labels: Record<EquipmentCategory, string> = {
    computer: 'Компьютер',
    monitor: 'Монитор',
    printer: 'Принтер',
    network: 'Сетевое оборудование',
    server: 'Сервер',
    mobile: 'Мобильное устройство',
    peripheral: 'Периферия',
    other: 'Прочее',
  };
  return labels[category] || category;
};



