import { pool } from '../config/database.js';
import {
  notifyNewTicketTelegram,
  notifyTicketAssignedTelegram,
  notifyTicketStatusChangedTelegram,
  notifyTicketCommentTelegram,
  notifyLowStockTelegram,
} from '../telegram/services/telegram-notification.service.js';

type NotificationType = 'info' | 'warning' | 'error' | 'success';

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  relatedType?: string;
  relatedId?: string;
}

/**
 * Создать уведомление для пользователя
 */
export async function createNotification(params: CreateNotificationParams): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, related_type, related_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.userId,
        params.title,
        params.message,
        params.type,
        params.relatedType || null,
        params.relatedId || null,
      ]
    );
    console.log(`[Notification] Создано уведомление для пользователя ${params.userId}: ${params.title}`);
  } catch (error) {
    console.error('[Notification] Ошибка создания уведомления:', error);
    // Не пробрасываем ошибку, чтобы не нарушить основной flow
  }
}

/**
 * Создать уведомление для нескольких пользователей
 */
export async function createNotificationForUsers(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
): Promise<void> {
  try {
    const values = userIds.map((userId) => [
      userId,
      params.title,
      params.message,
      params.type,
      params.relatedType || null,
      params.relatedId || null,
    ]);

    // Массовая вставка
    const placeholders = values
      .map((_, i) => {
        const offset = i * 6;
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
      })
      .join(', ');

    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, related_type, related_id)
       VALUES ${placeholders}`,
      values.flat()
    );

    console.log(`[Notification] Создано уведомление для ${userIds.length} пользователей: ${params.title}`);
  } catch (error) {
    console.error('[Notification] Ошибка массового создания уведомлений:', error);
  }
}

/**
 * Уведомление о новой заявке для IT-специалистов и админов
 */
export async function notifyNewTicket(ticketId: string, ticketTitle: string): Promise<void> {
  try {
    // Получаем всех админов и IT-специалистов
    const result = await pool.query(
      "SELECT id FROM users WHERE role IN ('admin', 'it_specialist')"
    );

    const userIds = result.rows.map((row) => row.id);

    if (userIds.length > 0) {
      await createNotificationForUsers(userIds, {
        title: 'Новая заявка',
        message: `Создана новая заявка: ${ticketTitle}`,
        type: 'info',
        relatedType: 'ticket',
        relatedId: ticketId,
      });
    }

    // Отправляем уведомление в Telegram
    await notifyNewTicketTelegram(ticketId, ticketTitle);
  } catch (error) {
    console.error('[Notification] Ошибка уведомления о новой заявке:', error);
  }
}

/**
 * Уведомление о назначении заявки
 */
export async function notifyTicketAssigned(
  assigneeId: string,
  ticketId: string,
  ticketTitle: string
): Promise<void> {
  await createNotification({
    userId: assigneeId,
    title: 'Вам назначена заявка',
    message: `Вам назначена заявка: ${ticketTitle}`,
    type: 'info',
    relatedType: 'ticket',
    relatedId: ticketId,
  });

  // Отправляем уведомление в Telegram
  await notifyTicketAssignedTelegram(assigneeId, ticketId, ticketTitle);
}

/**
 * Уведомление о изменении статуса заявки
 */
export async function notifyTicketStatusChanged(
  userId: string,
  ticketId: string,
  ticketTitle: string,
  newStatus: string
): Promise<void> {
  const statusLabels: Record<string, string> = {
    new: 'Новая',
    in_progress: 'В работе',
    waiting: 'Ожидание',
    pending_user: 'Ожидает пользователя',
    resolved: 'Решена',
    closed: 'Закрыта',
  };

  await createNotification({
    userId,
    title: 'Изменен статус заявки',
    message: `Заявка "${ticketTitle}" получила статус: ${statusLabels[newStatus] || newStatus}`,
    type: 'info',
    relatedType: 'ticket',
    relatedId: ticketId,
  });

  // Отправляем уведомление в Telegram
  await notifyTicketStatusChangedTelegram(userId, ticketId, ticketTitle, newStatus);
}

/**
 * Уведомление о новом комментарии к заявке
 */
export async function notifyTicketComment(
  userId: string,
  ticketId: string,
  ticketTitle: string,
  commenterName: string
): Promise<void> {
  await createNotification({
    userId,
    title: 'Новый комментарий к заявке',
    message: `${commenterName} оставил комментарий к заявке: ${ticketTitle}`,
    type: 'info',
    relatedType: 'ticket',
    relatedId: ticketId,
  });

  // Отправляем уведомление в Telegram
  await notifyTicketCommentTelegram(userId, ticketId, ticketTitle, commenterName);
}

/**
 * Уведомление о низком остатке расходников
 */
export async function notifyLowStock(consumableName: string, currentStock: number): Promise<void> {
  try {
    // Уведомляем админов и IT-специалистов
    const result = await pool.query(
      "SELECT id FROM users WHERE role IN ('admin', 'it_specialist')"
    );

    const userIds = result.rows.map((row) => row.id);

    if (userIds.length > 0) {
      await createNotificationForUsers(userIds, {
        title: 'Низкий остаток расходников',
        message: `Низкий остаток "${consumableName}": осталось ${currentStock} шт.`,
        type: 'warning',
        relatedType: 'consumable',
      });
    }

    // Отправляем уведомление в Telegram
    await notifyLowStockTelegram(consumableName, currentStock);
  } catch (error) {
    console.error('[Notification] Ошибка уведомления о низком остатке:', error);
  }
}

/**
 * Уведомление о перемещении оборудования
 */
export async function notifyEquipmentTransfer(
  userId: string,
  equipmentName: string,
  from: string,
  to: string
): Promise<void> {
  await createNotification({
    userId,
    title: 'Перемещение оборудования',
    message: `Оборудование "${equipmentName}" перемещено: ${from} → ${to}`,
    type: 'info',
    relatedType: 'equipment',
  });
}
