import { pool } from "../../config/database.js";
import type { BotContext, BotUser } from "../types.js";

export async function requireLinkedAccount(
  ctx: BotContext,
  next: () => Promise<void>,
): Promise<void> {
  const telegramId = ctx.from?.id;
  const isCallback = "callbackQuery" in ctx && ctx.callbackQuery;

  if (!telegramId) {
    if (isCallback) {
      await ctx.answerCbQuery("Ошибка идентификации").catch(() => {});
    } else {
      await ctx.reply("Ошибка идентификации пользователя.");
    }
    return;
  }

  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role, telegram_id, telegram_notifications
       FROM users
       WHERE telegram_id = $1 AND role IN ('admin', 'it_specialist')`,
      [telegramId],
    );

    if (result.rows.length === 0) {
      if (isCallback) {
        await ctx.answerCbQuery("Аккаунт не привязан").catch(() => {});
      }
      await ctx.reply(
        "🔒 *Доступ ограничен*\n\n" +
          "Ваш Telegram аккаунт не привязан к системе SupporIT или у вас нет прав доступа.\n\n" +
          "📝 Чтобы привязать аккаунт:\n" +
          "1. Войдите в веб-интерфейс SupporIT\n" +
          "2. Перейдите в настройки профиля\n" +
          '3. Нажмите "Привязать Telegram"\n' +
          "4. Используйте команду /link <код>",
        { parse_mode: "Markdown" },
      );
      return;
    }

    const user = result.rows[0] as BotUser;
    ctx.state = ctx.state || {};
    ctx.state.user = user;

    await next();
  } catch (error) {
    console.error("[Telegram Auth] Ошибка проверки авторизации:", error);
    if (isCallback) {
      await ctx.answerCbQuery("Ошибка проверки доступа").catch(() => {});
    }
    await ctx.reply("Произошла ошибка при проверке доступа. Попробуйте позже.");
  }
}

export async function getUserByTelegramId(
  telegramId: number,
): Promise<BotUser | null> {
  try {
    const result = await pool.query(
      `SELECT id, email, full_name, role, telegram_id, telegram_notifications
       FROM users
       WHERE telegram_id = $1`,
      [telegramId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as BotUser;
  } catch (error) {
    console.error("[Telegram Auth] Ошибка получения пользователя:", error);
    return null;
  }
}

export async function isLinkedAccount(telegramId: number): Promise<boolean> {
  try {
    const result = await pool.query(
      `SELECT 1 FROM users WHERE telegram_id = $1`,
      [telegramId],
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error("[Telegram Auth] Ошибка проверки привязки:", error);
    return false;
  }
}
