/**
 * Email Cron Service
 * Планировщик для проверки новых писем каждые 5 минут
 */

import cron from 'node-cron';
import { checkNewEmails } from './email-receiver.service.js';

/**
 * Запустить планировщик проверки email
 */
export function startEmailCron(): void {
  // Каждые 5 минут: '*/5 * * * *'
  // Формат: минуты часы день_месяца месяц день_недели
  const cronExpression = process.env.EMAIL_CHECK_CRON || '*/5 * * * *';

  console.log(`[Email Cron] 📅 Запуск планировщика: ${cronExpression}`);

  cron.schedule(cronExpression, async () => {
    const now = new Date().toLocaleString('ru-RU');
    console.log(`[Email Cron] ⏰ ${now} - Проверка новых писем...`);

    try {
      await checkNewEmails();
    } catch (error) {
      console.error('[Email Cron] ❌ Ошибка при проверке писем:', error);
      // Не прерываем работу, следующая проверка произойдет через 5 минут
    }
  });

  console.log('[Email Cron] ✅ Планировщик запущен успешно (проверка каждые 5 минут)');
}
