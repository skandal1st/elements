import type { TicketData, EquipmentData, TicketStatus, TicketPriority } from '../types.js';

const STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  waiting: 'Ожидание',
  resolved: 'Решена',
  closed: 'Закрыта',
  pending_user: 'Ожидает пользователя',
};

const STATUS_EMOJI: Record<TicketStatus, string> = {
  new: '🔵',
  in_progress: '🟡',
  waiting: '🟠',
  resolved: '🟢',
  closed: '⚫',
  pending_user: '🟣',
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
};

const PRIORITY_EMOJI: Record<TicketPriority, string> = {
  low: '⬇️',
  medium: '➡️',
  high: '⬆️',
  critical: '🔴',
};

const CATEGORY_LABELS: Record<string, string> = {
  hardware: 'Оборудование',
  software: 'ПО',
  network: 'Сеть',
  other: 'Прочее',
};

const EQUIPMENT_STATUS_LABELS: Record<string, string> = {
  in_use: 'В использовании',
  in_stock: 'На складе',
  in_repair: 'В ремонте',
  written_off: 'Списано',
};

const EQUIPMENT_STATUS_EMOJI: Record<string, string> = {
  in_use: '✅',
  in_stock: '📦',
  in_repair: '🔧',
  written_off: '❌',
};

export function formatTicketCard(ticket: TicketData): string {
  const statusEmoji = STATUS_EMOJI[ticket.status as TicketStatus] || '❓';
  const statusLabel = STATUS_LABELS[ticket.status as TicketStatus] || ticket.status;
  const priorityEmoji = PRIORITY_EMOJI[ticket.priority as TicketPriority] || '➡️';
  const priorityLabel = PRIORITY_LABELS[ticket.priority as TicketPriority] || ticket.priority;
  const categoryLabel = CATEGORY_LABELS[ticket.category] || ticket.category;

  let message = `📋 *Заявка #${ticket.id.slice(0, 8)}*\n\n`;
  message += `📌 ${escapeMarkdown(ticket.title)}\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `📊 Статус: ${statusEmoji} ${statusLabel}\n`;
  message += `${priorityEmoji} Приоритет: ${priorityLabel}\n`;
  message += `📁 Категория: ${categoryLabel}\n`;

  if (ticket.creator_name) {
    message += `👤 Создатель: ${escapeMarkdown(ticket.creator_name)}`;
    if (ticket.creator_department) {
      message += ` (${escapeMarkdown(ticket.creator_department)})`;
    }
    message += '\n';
  }

  if (ticket.assignee_name) {
    message += `🔧 Исполнитель: ${escapeMarkdown(ticket.assignee_name)}\n`;
  }

  if (ticket.location_department || ticket.location_room) {
    message += `🏢 Местоположение: `;
    if (ticket.location_department) message += escapeMarkdown(ticket.location_department);
    if (ticket.location_room) message += ` - Каб. ${escapeMarkdown(ticket.location_room)}`;
    message += '\n';
  }

  if (ticket.equipment_name) {
    message += `🖥 Оборудование: ${escapeMarkdown(ticket.equipment_name)}\n`;
  }

  const createdDate = new Date(ticket.created_at).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  message += `📅 Создана: ${createdDate}\n`;

  if (ticket.description) {
    const shortDescription = ticket.description.length > 200
      ? ticket.description.slice(0, 200) + '...'
      : ticket.description;
    message += `\n📝 *Описание:*\n${escapeMarkdown(shortDescription)}`;
  }

  return message;
}

export function formatTicketListItem(ticket: TicketData, index: number): string {
  const statusEmoji = STATUS_EMOJI[ticket.status as TicketStatus] || '❓';
  const priorityEmoji = PRIORITY_EMOJI[ticket.priority as TicketPriority] || '➡️';

  const shortTitle = ticket.title.length > 40
    ? ticket.title.slice(0, 40) + '...'
    : ticket.title;

  return `${index}. ${statusEmoji}${priorityEmoji} ${escapeMarkdown(shortTitle)}\n   #${ticket.id.slice(0, 8)}`;
}

export function formatEquipmentCard(equipment: EquipmentData): string {
  const statusEmoji = EQUIPMENT_STATUS_EMOJI[equipment.status] || '❓';
  const statusLabel = EQUIPMENT_STATUS_LABELS[equipment.status] || equipment.status;

  let message = `🖥️ *Оборудование найдено!*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `📋 Название: ${escapeMarkdown(equipment.name)}\n`;

  if (equipment.manufacturer) {
    message += `🏭 Производитель: ${escapeMarkdown(equipment.manufacturer)}\n`;
  }

  if (equipment.model) {
    message += `📦 Модель: ${escapeMarkdown(equipment.model)}\n`;
  }

  message += `🔢 Инв. номер: ${escapeMarkdown(equipment.inventory_number)}\n`;

  if (equipment.serial_number) {
    message += `🔖 Серийный номер: ${escapeMarkdown(equipment.serial_number)}\n`;
  }

  message += `📊 Статус: ${statusEmoji} ${statusLabel}\n`;

  if (equipment.owner_name) {
    message += `\n👤 Владелец: ${escapeMarkdown(equipment.owner_name)}\n`;
  }

  if (equipment.location_department || equipment.location_room) {
    message += `🏢 Расположение: `;
    if (equipment.location_department) message += escapeMarkdown(equipment.location_department);
    if (equipment.location_room) message += ` - Каб. ${escapeMarkdown(equipment.location_room)}`;
    message += '\n';
  }

  if (equipment.purchase_date) {
    const purchaseDate = new Date(equipment.purchase_date).toLocaleDateString('ru-RU');
    message += `\n📅 Дата покупки: ${purchaseDate}\n`;
  }

  if (equipment.warranty_until) {
    const warrantyDate = new Date(equipment.warranty_until).toLocaleDateString('ru-RU');
    const isExpired = new Date(equipment.warranty_until) < new Date();
    message += `🛡️ Гарантия до: ${warrantyDate} ${isExpired ? '(истекла)' : ''}\n`;
  }

  return message;
}

export function formatNotification(title: string, message: string, ticketId?: string): string {
  let text = `🔔 *${escapeMarkdown(title)}*\n\n`;
  text += escapeMarkdown(message);

  if (ticketId) {
    text += `\n\n📋 Заявка: #${ticketId.slice(0, 8)}`;
  }

  return text;
}

export function escapeMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/`/g, '\\`');
}

export function getStatusLabel(status: TicketStatus): string {
  return STATUS_LABELS[status] || status;
}

export function getPriorityLabel(priority: TicketPriority): string {
  return PRIORITY_LABELS[priority] || priority;
}
