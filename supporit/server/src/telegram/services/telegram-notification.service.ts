import { pool } from '../../config/database.js';
import { getBot } from '../bot.js';
import { formatNotification } from '../utils/formatters.js';

interface NotificationParams {
  userId: string;
  title: string;
  message: string;
  ticketId?: string;
}

export async function sendTelegramNotification(params: NotificationParams): Promise<boolean> {
  const bot = getBot();

  if (!bot) {
    return false;
  }

  try {
    // Получаем telegram_id пользователя
    const result = await pool.query(
      `SELECT telegram_id, telegram_notifications
       FROM users
       WHERE id = $1 AND telegram_id IS NOT NULL AND telegram_notifications = true`,
      [params.userId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const { telegram_id } = result.rows[0];
    const text = formatNotification(params.title, params.message, params.ticketId);

    const keyboard = params.ticketId
      ? {
          inline_keyboard: [
            [{ text: '📋 Открыть заявку', callback_data: `ticket_view_${params.ticketId}` }],
          ],
        }
      : undefined;

    await bot.telegram.sendMessage(telegram_id, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });

    return true;
  } catch (error) {
    console.error('[Telegram Notification] Ошибка отправки:', error);
    return false;
  }
}

export async function sendTelegramNotificationToMany(
  userIds: string[],
  title: string,
  message: string,
  ticketId?: string
): Promise<number> {
  let successCount = 0;

  for (const userId of userIds) {
    const success = await sendTelegramNotification({
      userId,
      title,
      message,
      ticketId,
    });

    if (success) {
      successCount++;
    }
  }

  return successCount;
}

export async function notifyNewTicketTelegram(
  ticketId: string,
  ticketTitle: string
): Promise<void> {
  const bot = getBot();

  if (!bot) {
    return;
  }

  try {
    // Получаем всех ИТ-специалистов и админов с привязанным Telegram
    const result = await pool.query(
      `SELECT telegram_id
       FROM users
       WHERE role IN ('admin', 'it_specialist')
         AND telegram_id IS NOT NULL
         AND telegram_notifications = true`
    );

    const text = formatNotification(
      'Новая заявка',
      `Поступила новая заявка: "${ticketTitle}"`,
      ticketId
    );

    const keyboard = {
      inline_keyboard: [
        [{ text: '📋 Открыть заявку', callback_data: `ticket_view_${ticketId}` }],
      ],
    };

    for (const row of result.rows) {
      try {
        await bot.telegram.sendMessage(row.telegram_id, text, {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        });
      } catch (err) {
        console.error(`[Telegram Notification] Ошибка отправки пользователю ${row.telegram_id}:`, err);
      }
    }
  } catch (error) {
    console.error('[Telegram Notification] Ошибка уведомления о новой заявке:', error);
  }
}

export async function notifyTicketAssignedTelegram(
  assigneeId: string,
  ticketId: string,
  ticketTitle: string
): Promise<void> {
  await sendTelegramNotification({
    userId: assigneeId,
    title: 'Назначена заявка',
    message: `Вам назначена заявка: "${ticketTitle}"`,
    ticketId,
  });
}

export async function notifyTicketStatusChangedTelegram(
  userId: string,
  ticketId: string,
  ticketTitle: string,
  newStatus: string
): Promise<void> {
  const statusLabels: Record<string, string> = {
    new: 'Новая',
    in_progress: 'В работе',
    waiting: 'Ожидание',
    resolved: 'Решена',
    closed: 'Закрыта',
  };

  const statusLabel = statusLabels[newStatus] || newStatus;

  await sendTelegramNotification({
    userId,
    title: 'Статус заявки изменён',
    message: `Заявка "${ticketTitle}" изменила статус на "${statusLabel}"`,
    ticketId,
  });
}

export async function notifyTicketCommentTelegram(
  userId: string,
  ticketId: string,
  ticketTitle: string,
  commenterName: string
): Promise<void> {
  await sendTelegramNotification({
    userId,
    title: 'Новый комментарий',
    message: `${commenterName} добавил комментарий к заявке "${ticketTitle}"`,
    ticketId,
  });
}

export async function notifyLowStockTelegram(
  consumableName: string,
  currentStock: number
): Promise<void> {
  const bot = getBot();

  if (!bot) {
    return;
  }

  try {
    const result = await pool.query(
      `SELECT telegram_id
       FROM users
       WHERE role IN ('admin', 'it_specialist')
         AND telegram_id IS NOT NULL
         AND telegram_notifications = true`
    );

    const text = formatNotification(
      '⚠️ Низкий остаток расходников',
      `Расходник "${consumableName}" заканчивается.\nТекущий остаток: ${currentStock} шт.`
    );

    for (const row of result.rows) {
      try {
        await bot.telegram.sendMessage(row.telegram_id, text, {
          parse_mode: 'Markdown',
        });
      } catch (err) {
        console.error(`[Telegram Notification] Ошибка отправки пользователю ${row.telegram_id}:`, err);
      }
    }
  } catch (error) {
    console.error('[Telegram Notification] Ошибка уведомления о низком остатке:', error);
  }
}
