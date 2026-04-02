import { pool } from "../../config/database.js";
import type { BotContext } from "../types.js";
import { showTicketDetails, resolveTicketId } from "./callbacks.js";
import { mainMenuKeyboard } from "../keyboards/inline.js";

// Хранилище состояний пользователей (в реальном приложении лучше использовать Redis)
const userStates = new Map<
  number,
  {
    action: "comment" | "create_ticket";
    ticketId?: string;
    equipmentId?: string;
  }
>();

export function setUserState(
  telegramId: number,
  state: {
    action: "comment" | "create_ticket";
    ticketId?: string;
    equipmentId?: string;
  },
): void {
  userStates.set(telegramId, state);
}

export function getUserState(telegramId: number) {
  return userStates.get(telegramId);
}

export function clearUserState(telegramId: number): void {
  userStates.delete(telegramId);
}

export async function handleTextMessage(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const message = ctx.message;
  if (!message || !("text" in message)) return;

  const text = message.text;

  // Игнорируем команды
  if (text.startsWith("/")) return;

  // Проверяем состояние пользователя
  const state = getUserState(telegramId);

  if (!state) {
    // Нет активного действия, показываем подсказку
    await ctx.reply(
      "💡 Используйте команды или кнопки для взаимодействия с ботом.\n\n" +
        "Отправьте /help для списка команд.",
      mainMenuKeyboard,
    );
    return;
  }

  if (state.action === "comment" && state.ticketId) {
    await handleAddComment(ctx, state.ticketId, text);
    clearUserState(telegramId);
  } else if (state.action === "create_ticket" && state.equipmentId) {
    await handleCreateTicket(ctx, state.equipmentId, text);
    clearUserState(telegramId);
  }
}

async function handleAddComment(
  ctx: BotContext,
  ticketId: string,
  content: string,
): Promise<void> {
  if (!ctx.state.user) {
    await ctx.reply("❌ Ошибка авторизации.");
    return;
  }

  try {
    // Резолвим короткий ID в полный UUID
    const fullTicketId = await resolveTicketId(ticketId);
    if (!fullTicketId) {
      await ctx.reply("❌ Заявка не найдена.");
      return;
    }

    // Добавляем комментарий
    await pool.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, content, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [fullTicketId, ctx.state.user.id, content],
    );

    // Обновляем дату обновления заявки
    await pool.query(`UPDATE tickets SET updated_at = NOW() WHERE id = $1`, [
      fullTicketId,
    ]);

    await ctx.reply("✅ Комментарий добавлен!");

    // Показываем обновлённую заявку
    await showTicketDetails(ctx, ticketId);
  } catch (error) {
    console.error("[Telegram Messages] Ошибка добавления комментария:", error);
    await ctx.reply("❌ Ошибка при добавлении комментария.");
  }
}

async function handleCreateTicket(
  ctx: BotContext,
  equipmentId: string,
  description: string,
): Promise<void> {
  if (!ctx.state.user) {
    await ctx.reply("❌ Ошибка авторизации.");
    return;
  }

  try {
    // Получаем информацию об оборудовании
    const equipmentResult = await pool.query(
      `SELECT name, location_department, location_room
       FROM equipment WHERE id = $1`,
      [equipmentId],
    );

    if (equipmentResult.rows.length === 0) {
      await ctx.reply("❌ Оборудование не найдено.");
      return;
    }

    const equipment = equipmentResult.rows[0];

    // Создаём заявку
    const title = `Проблема с ${equipment.name}`;

    const result = await pool.query(
      `INSERT INTO tickets (
         title, description, category, priority, status,
         creator_id, equipment_id, location_department, location_room,
         created_via, created_at, updated_at
       )
       VALUES ($1, $2, 'hardware', 'medium', 'new', $3, $4, $5, $6, 'telegram', NOW(), NOW())
       RETURNING id`,
      [
        title,
        description,
        ctx.state.user.id,
        equipmentId,
        equipment.location_department,
        equipment.location_room,
      ],
    );

    const ticketId = result.rows[0].id;

    await ctx.reply(
      `✅ *Заявка создана!*\n\n` +
        `📋 Номер: #${ticketId.slice(0, 8)}\n` +
        `📌 ${title}\n\n` +
        `Заявка появится в системе SupporIT.`,
      { parse_mode: "Markdown" },
    );

    // Показываем созданную заявку
    await showTicketDetails(ctx, ticketId);
  } catch (error) {
    console.error("[Telegram Messages] Ошибка создания заявки:", error);
    await ctx.reply("❌ Ошибка при создании заявки.");
  }
}

export async function handleCancelAction(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  if (telegramId) {
    clearUserState(telegramId);
  }

  await ctx.editMessageText("❌ Действие отменено.", mainMenuKeyboard);
}
