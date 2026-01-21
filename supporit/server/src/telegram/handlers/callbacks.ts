import { pool } from "../../config/database.js";
import type { BotContext, TicketData, TicketStatus } from "../types.js";
import {
  mainMenuKeyboard,
  ticketsFilterKeyboard,
  ticketActionsKeyboard,
  ticketStatusKeyboard,
  ticketListKeyboard,
  settingsKeyboard,
  confirmUnlinkKeyboard,
} from "../keyboards/inline.js";
import { formatTicketCard, formatTicketListItem } from "../utils/formatters.js";

// Вспомогательная функция для получения полного UUID по короткому ID
export async function resolveTicketId(
  shortOrFullId: string,
): Promise<string | null> {
  if (shortOrFullId.length === 36) {
    return shortOrFullId; // Уже полный UUID
  }

  const result = await pool.query(
    `SELECT id FROM tickets WHERE id::text LIKE $1 LIMIT 1`,
    [`${shortOrFullId}%`],
  );

  return result.rows.length > 0 ? result.rows[0].id : null;
}

export async function handleMainMenu(ctx: BotContext): Promise<void> {
  await ctx.editMessageText("🏠 *Главное меню*\n\nВыберите действие:", {
    parse_mode: "Markdown",
    ...mainMenuKeyboard,
  });
}

export async function handleTicketsList(
  ctx: BotContext,
  filter: string = "all",
): Promise<void> {
  try {
    // Сразу отвечаем на callback, чтобы убрать "часики"
    await ctx.answerCbQuery().catch(() => {});

    let whereClause = "status NOT IN ('closed', 'resolved', 'pending_user')";

    if (filter !== "all") {
      whereClause = `status = '${filter}'`;
    }

    const result = await pool.query(
      `SELECT t.id, t.title, t.status, t.priority, t.created_at
       FROM tickets t
       WHERE ${whereClause}
       ORDER BY
         CASE t.priority
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
         END,
         t.created_at DESC
       LIMIT 10`,
    );

    const tickets = result.rows;

    if (tickets.length === 0) {
      const filterLabel =
        filter === "all"
          ? "активных"
          : filter === "new"
            ? "новых"
            : filter === "in_progress"
              ? "в работе"
              : filter === "waiting"
                ? "ожидающих"
                : "";

      try {
        await ctx.editMessageText(`📋 *Заявки*\n\nНет ${filterLabel} заявок.`, {
          parse_mode: "Markdown",
          ...ticketsFilterKeyboard,
        });
      } catch {
        await ctx.reply(`📋 *Заявки*\n\nНет ${filterLabel} заявок.`, {
          parse_mode: "Markdown",
          ...ticketsFilterKeyboard,
        });
      }
      return;
    }

    let message = `📋 *Активные заявки* (${tickets.length})\n\n`;
    tickets.forEach((t: TicketData, i: number) => {
      message += formatTicketListItem(t, i + 1) + "\n\n";
    });

    try {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        ...ticketListKeyboard(tickets, filter),
      });
    } catch {
      await ctx.reply(message, {
        parse_mode: "Markdown",
        ...ticketListKeyboard(tickets, filter),
      });
    }
  } catch (error) {
    console.error("[Telegram Callbacks] Ошибка получения заявок:", error);
    await ctx.answerCbQuery("Ошибка загрузки заявок").catch(() => {});
  }
}

export async function handleMyTickets(ctx: BotContext): Promise<void> {
  if (!ctx.state.user) {
    await ctx.answerCbQuery("Ошибка авторизации");
    return;
  }

  try {
    const result = await pool.query(
      `SELECT t.id, t.title, t.status, t.priority, t.created_at
       FROM tickets t
       WHERE t.assignee_id = $1 AND t.status NOT IN ('closed', 'resolved')
       ORDER BY
         CASE t.priority
           WHEN 'critical' THEN 1
           WHEN 'high' THEN 2
           WHEN 'medium' THEN 3
           WHEN 'low' THEN 4
         END,
         t.created_at DESC
       LIMIT 10`,
      [ctx.state.user.id],
    );

    const tickets = result.rows;

    if (tickets.length === 0) {
      await ctx.editMessageText(
        "📋 *Мои заявки*\n\nУ вас нет назначенных активных заявок.",
        { parse_mode: "Markdown", ...mainMenuKeyboard },
      );
      return;
    }

    let message = `📋 *Мои заявки* (${tickets.length})\n\n`;
    tickets.forEach((t: TicketData, i: number) => {
      message += formatTicketListItem(t, i + 1) + "\n\n";
    });

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      ...ticketListKeyboard(tickets, "my"),
    });
  } catch (error) {
    console.error("[Telegram Callbacks] Ошибка получения моих заявок:", error);
    await ctx.answerCbQuery("Ошибка загрузки заявок");
  }
}

export async function showTicketDetails(
  ctx: BotContext,
  ticketId: string,
): Promise<void> {
  try {
    // Поддержка как полного UUID, так и короткого ID
    const idCondition = ticketId.length === 36 ? "id = $1" : "id::text LIKE $1";
    const idValue = ticketId.length === 36 ? ticketId : `${ticketId}%`;

    const result = await pool.query(
      `SELECT
         t.id, t.title, t.description, t.category, t.priority, t.status,
         t.location_department, t.location_room, t.created_at,
         creator.full_name as creator_name,
         creator.department as creator_department,
         assignee.full_name as assignee_name,
         e.name as equipment_name
       FROM tickets t
       LEFT JOIN users creator ON t.creator_id = creator.id
       LEFT JOIN users assignee ON t.assignee_id = assignee.id
       LEFT JOIN equipment e ON t.equipment_id = e.id
       WHERE t.${idCondition}
       LIMIT 1`,
      [idValue],
    );

    if (result.rows.length === 0) {
      const errorMsg = "❌ Заявка не найдена.";
      if (ctx.callbackQuery) {
        await ctx.editMessageText(errorMsg, mainMenuKeyboard);
      } else {
        await ctx.reply(errorMsg);
      }
      return;
    }

    const ticket = result.rows[0] as TicketData;
    const message = formatTicketCard(ticket);
    const keyboard = ticketActionsKeyboard(
      ticket.id,
      ticket.status as TicketStatus,
    );

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: "Markdown",
        ...keyboard,
      });
    } else {
      await ctx.reply(message, { parse_mode: "Markdown", ...keyboard });
    }
  } catch (error) {
    console.error("[Telegram Callbacks] Ошибка получения заявки:", error);
    const errorMsg = "Ошибка загрузки заявки.";
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMsg);
    } else {
      await ctx.reply(errorMsg);
    }
  }
}

export async function handleTakeTicket(
  ctx: BotContext,
  ticketId: string,
): Promise<void> {
  if (!ctx.state.user) {
    await ctx.answerCbQuery("Ошибка авторизации");
    return;
  }

  try {
    // Получаем полный UUID по короткому ID
    const fullId = await resolveTicketId(ticketId);
    if (!fullId) {
      await ctx.answerCbQuery("Заявка не найдена");
      return;
    }

    const result = await pool.query(
      `UPDATE tickets
       SET status = 'in_progress',
           assignee_id = $1,
           updated_at = NOW()
       WHERE id = $2 AND status = 'new'
       RETURNING id`,
      [ctx.state.user.id, fullId],
    );

    if (result.rows.length === 0) {
      await ctx.answerCbQuery("Заявка уже взята в работу или не найдена");
      return;
    }

    await ctx.answerCbQuery("✅ Заявка взята в работу");
    await showTicketDetails(ctx, fullId);
  } catch (error) {
    console.error("[Telegram Callbacks] Ошибка взятия заявки:", error);
    await ctx.answerCbQuery("Ошибка при взятии заявки");
  }
}

export async function handleShowStatusMenu(
  ctx: BotContext,
  ticketId: string,
): Promise<void> {
  try {
    // Получаем полный UUID по короткому ID
    const fullId = await resolveTicketId(ticketId);
    if (!fullId) {
      await ctx.answerCbQuery("Заявка не найдена");
      return;
    }

    const result = await pool.query(
      `SELECT status FROM tickets WHERE id = $1`,
      [fullId],
    );

    if (result.rows.length === 0) {
      await ctx.answerCbQuery("Заявка не найдена");
      return;
    }

    const currentStatus = result.rows[0].status as TicketStatus;

    await ctx.editMessageText(
      "📊 *Изменение статуса*\n\nВыберите новый статус:",
      {
        parse_mode: "Markdown",
        ...ticketStatusKeyboard(fullId, currentStatus),
      },
    );
  } catch (error) {
    console.error("[Telegram Callbacks] Ошибка показа меню статуса:", error);
    await ctx.answerCbQuery("Ошибка загрузки");
  }
}

export async function handleSetStatus(
  ctx: BotContext,
  ticketId: string,
  newStatus: TicketStatus,
): Promise<void> {
  if (!ctx.state.user) {
    await ctx.answerCbQuery("Ошибка авторизации");
    return;
  }

  try {
    // Получаем полный UUID по короткому ID
    const fullId = await resolveTicketId(ticketId);
    if (!fullId) {
      await ctx.answerCbQuery("Заявка не найдена");
      return;
    }

    const updateData: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Устанавливаем даты при изменении статуса
    if (newStatus === "resolved") {
      updateData.resolved_at = new Date().toISOString();
    } else if (newStatus === "closed") {
      updateData.closed_at = new Date().toISOString();
    }

    // Назначаем исполнителя при взятии в работу
    if (newStatus === "in_progress") {
      updateData.assignee_id = ctx.state.user.id;
    }

    const setClauses = Object.keys(updateData)
      .map((key, i) => `${key} = $${i + 2}`)
      .join(", ");
    const values = [fullId, ...Object.values(updateData)];

    await pool.query(`UPDATE tickets SET ${setClauses} WHERE id = $1`, values);

    const statusLabels: Record<string, string> = {
      new: "Новая",
      in_progress: "В работе",
      waiting: "Ожидание",
      resolved: "Решена",
      closed: "Закрыта",
    };

    await ctx.answerCbQuery(
      `✅ Статус изменён на "${statusLabels[newStatus]}"`,
    );
    await showTicketDetails(ctx, fullId);
  } catch (error) {
    console.error("[Telegram Callbacks] Ошибка изменения статуса:", error);
    await ctx.answerCbQuery("Ошибка при изменении статуса");
  }
}

export async function handleCommentPrompt(
  ctx: BotContext,
  ticketId: string,
): Promise<void> {
  // Получаем полный UUID по короткому ID
  const fullId = await resolveTicketId(ticketId);
  if (!fullId) {
    await ctx.answerCbQuery("Заявка не найдена");
    return;
  }

  // Сохраняем полный ID заявки в сессии для последующего добавления комментария
  ctx.state.pendingCommentTicketId = fullId;

  const shortId = fullId.slice(0, 8);
  await ctx.editMessageText(
    "💬 *Добавление комментария*\n\n" +
      `Заявка: #${shortId}\n\n` +
      "Отправьте текст комментария следующим сообщением.\n\n" +
      "_Для отмены нажмите кнопку ниже._",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "❌ Отмена", callback_data: `t_view_${shortId}` }],
        ],
      },
    },
  );
}

export async function showSettings(ctx: BotContext): Promise<void> {
  if (!ctx.state.user) {
    await ctx.answerCbQuery("Ошибка авторизации");
    return;
  }

  const notificationsEnabled = ctx.state.user.telegram_notifications;

  const message =
    "⚙️ *Настройки*\n\n" +
    `🔔 Уведомления: ${notificationsEnabled ? "Включены" : "Выключены"}\n` +
    `👤 Аккаунт: ${ctx.state.user.full_name}\n` +
    `📧 Email: ${ctx.state.user.email}`;

  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      ...settingsKeyboard(notificationsEnabled),
    });
  } else {
    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...settingsKeyboard(notificationsEnabled),
    });
  }
}

export async function handleToggleNotifications(
  ctx: BotContext,
): Promise<void> {
  if (!ctx.state.user) {
    await ctx.answerCbQuery("Ошибка авторизации");
    return;
  }

  try {
    const newValue = !ctx.state.user.telegram_notifications;

    await pool.query(
      `UPDATE users SET telegram_notifications = $1 WHERE id = $2`,
      [newValue, ctx.state.user.id],
    );

    ctx.state.user.telegram_notifications = newValue;

    await ctx.answerCbQuery(
      newValue ? "🔔 Уведомления включены" : "🔕 Уведомления выключены",
    );

    await showSettings(ctx);
  } catch (error) {
    console.error(
      "[Telegram Callbacks] Ошибка переключения уведомлений:",
      error,
    );
    await ctx.answerCbQuery("Ошибка сохранения настроек");
  }
}

export async function handleUnlinkPrompt(ctx: BotContext): Promise<void> {
  await ctx.editMessageText(
    "⚠️ *Отвязка аккаунта*\n\n" +
      "Вы уверены, что хотите отвязать Telegram от аккаунта SupporIT?\n\n" +
      "После отвязки вы перестанете получать уведомления.",
    { parse_mode: "Markdown", ...confirmUnlinkKeyboard },
  );
}

export async function handleConfirmUnlink(ctx: BotContext): Promise<void> {
  if (!ctx.state.user) {
    await ctx.answerCbQuery("Ошибка авторизации");
    return;
  }

  try {
    await pool.query(
      `UPDATE users
       SET telegram_id = NULL,
           telegram_username = NULL,
           telegram_linked_at = NULL,
           telegram_notifications = false
       WHERE id = $1`,
      [ctx.state.user.id],
    );

    await ctx.editMessageText(
      "✅ Аккаунт успешно отвязан.\n\n" +
        "Для повторной привязки используйте команду /link <код>",
    );
  } catch (error) {
    console.error("[Telegram Callbacks] Ошибка отвязки:", error);
    await ctx.answerCbQuery("Ошибка при отвязке аккаунта");
  }
}
