import { pool } from '../../config/database.js';
import type { BotContext } from '../types.js';
import { mainMenuKeyboard, ticketsFilterKeyboard } from '../keyboards/inline.js';
import { isLinkedAccount } from '../middleware/auth.js';

export async function handleStart(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  const firstName = ctx.from?.first_name || 'Пользователь';

  if (!telegramId) {
    await ctx.reply('Ошибка идентификации.');
    return;
  }

  const isLinked = await isLinkedAccount(telegramId);

  if (isLinked) {
    await ctx.reply(
      `👋 Привет, ${firstName}!\n\n` +
      `Добро пожаловать в бот *SupporIT*.\n` +
      `Здесь вы можете управлять заявками и получать уведомления.\n\n` +
      `Выберите действие:`,
      { parse_mode: 'Markdown', ...mainMenuKeyboard }
    );
  } else {
    await ctx.reply(
      `👋 Привет, ${firstName}!\n\n` +
      `Это бот системы *SupporIT* для ИТ-специалистов.\n\n` +
      `🔒 Ваш аккаунт не привязан.\n\n` +
      `📝 *Как привязать:*\n` +
      `1. Войдите в веб-интерфейс SupporIT\n` +
      `2. Перейдите в Настройки → Telegram\n` +
      `3. Нажмите "Получить код"\n` +
      `4. Отправьте команду: /link <код>\n\n` +
      `Пример: \`/link 123456\``,
      { parse_mode: 'Markdown' }
    );
  }
}

export async function handleHelp(ctx: BotContext): Promise<void> {
  await ctx.reply(
    `📚 *Справка по командам*\n\n` +
    `🔗 *Привязка аккаунта:*\n` +
    `/link <код> - привязать Telegram к SupporIT\n\n` +
    `📋 *Работа с заявками:*\n` +
    `/tickets - список активных заявок\n` +
    `/ticket <id> - детали заявки\n\n` +
    `⚙️ *Настройки:*\n` +
    `/settings - настройки уведомлений\n\n` +
    `📷 *QR-коды:*\n` +
    `Отправьте фото QR-кода оборудования, чтобы получить информацию о нём.\n\n` +
    `💡 *Подсказка:*\n` +
    `Используйте inline-кнопки для быстрой навигации.`,
    { parse_mode: 'Markdown' }
  );
}

export async function handleLink(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;
  const username = ctx.from?.username;

  if (!telegramId) {
    await ctx.reply('Ошибка идентификации.');
    return;
  }

  // Проверяем, не привязан ли уже аккаунт
  const existingLink = await isLinkedAccount(telegramId);
  if (existingLink) {
    await ctx.reply(
      '✅ Ваш Telegram уже привязан к аккаунту SupporIT.\n\n' +
      'Используйте /start для доступа к функциям бота.'
    );
    return;
  }

  // Получаем код из сообщения
  const message = ctx.message;
  if (!message || !('text' in message)) {
    await ctx.reply('Ошибка обработки сообщения.');
    return;
  }

  const text = message.text;
  const parts = text.split(' ');

  if (parts.length < 2) {
    await ctx.reply(
      '❌ Укажите код привязки.\n\n' +
      'Пример: `/link 123456`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const code = parts[1].trim();

  if (!/^\d{6}$/.test(code)) {
    await ctx.reply(
      '❌ Неверный формат кода.\n\n' +
      'Код должен состоять из 6 цифр.'
    );
    return;
  }

  try {
    // Ищем код в базе данных
    const codeResult = await pool.query(
      `SELECT id, user_id, expires_at
       FROM telegram_link_codes
       WHERE code = $1 AND used_at IS NULL`,
      [code]
    );

    if (codeResult.rows.length === 0) {
      await ctx.reply(
        '❌ Код не найден или уже использован.\n\n' +
        'Запросите новый код в веб-интерфейсе SupporIT.'
      );
      return;
    }

    const linkCode = codeResult.rows[0];

    // Проверяем срок действия
    if (new Date(linkCode.expires_at) < new Date()) {
      await ctx.reply(
        '❌ Срок действия кода истёк.\n\n' +
        'Запросите новый код в веб-интерфейсе SupporIT.'
      );
      return;
    }

    // Проверяем роль пользователя
    const userResult = await pool.query(
      `SELECT role FROM users WHERE id = $1`,
      [linkCode.user_id]
    );

    if (userResult.rows.length === 0) {
      await ctx.reply('❌ Пользователь не найден.');
      return;
    }

    const userRole = userResult.rows[0].role;
    if (userRole !== 'admin' && userRole !== 'it_specialist') {
      await ctx.reply(
        '❌ Доступ запрещён.\n\n' +
        'Бот доступен только для ИТ-специалистов и администраторов.'
      );
      return;
    }

    // Привязываем Telegram к пользователю
    await pool.query(
      `UPDATE users
       SET telegram_id = $1,
           telegram_username = $2,
           telegram_linked_at = NOW(),
           telegram_notifications = true
       WHERE id = $3`,
      [telegramId, username || null, linkCode.user_id]
    );

    // Отмечаем код как использованный
    await pool.query(
      `UPDATE telegram_link_codes
       SET used_at = NOW()
       WHERE id = $1`,
      [linkCode.id]
    );

    await ctx.reply(
      '✅ *Аккаунт успешно привязан!*\n\n' +
      'Теперь вы будете получать уведомления о заявках в Telegram.\n\n' +
      'Используйте /start для доступа к главному меню.',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('[Telegram Link] Ошибка привязки:', error);
    await ctx.reply('Произошла ошибка при привязке аккаунта. Попробуйте позже.');
  }
}

export async function handleTickets(ctx: BotContext): Promise<void> {
  await ctx.reply(
    '📋 *Фильтр заявок*\n\n' +
    'Выберите статус для отображения:',
    { parse_mode: 'Markdown', ...ticketsFilterKeyboard }
  );
}

export async function handleTicketById(ctx: BotContext): Promise<void> {
  const message = ctx.message;
  if (!message || !('text' in message)) {
    return;
  }

  const text = message.text;
  const parts = text.split(' ');

  if (parts.length < 2) {
    await ctx.reply(
      '❌ Укажите ID заявки.\n\n' +
      'Пример: `/ticket abc12345`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const ticketId = parts[1].trim();

  // Импортируем функцию показа заявки из callbacks
  const { showTicketDetails } = await import('./callbacks.js');
  await showTicketDetails(ctx, ticketId);
}

export async function handleSettings(ctx: BotContext): Promise<void> {
  const { showSettings } = await import('./callbacks.js');
  await showSettings(ctx);
}
