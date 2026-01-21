import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌ ОШИБКА: DATABASE_URL не установлен в переменных окружения!');
  console.error('Создайте файл .env в папке server/ и добавьте:');
  console.error('DATABASE_URL=postgresql://user:password@localhost:5432/supporit');
  process.exit(1);
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Тест подключения при старте
pool.connect()
  .then((client) => {
    console.log('✅ Подключение к PostgreSQL установлено');
    client.release();
  })
  .catch((err) => {
    console.error('❌ ОШИБКА ПОДКЛЮЧЕНИЯ К POSTGRESQL:');
    console.error('Проверьте:');
    console.error('1. PostgreSQL запущен? (pg_ctl status или служба PostgreSQL)');
    console.error('2. DATABASE_URL правильный? (проверьте .env файл)');
    console.error('3. База данных создана? (CREATE DATABASE supporit;)');
    console.error('4. Пользователь и пароль правильные?');
    console.error('');
    console.error('Детали ошибки:', err.message);
    console.error('');
    console.error('Пример правильного DATABASE_URL:');
    console.error('DATABASE_URL=postgresql://postgres:password@localhost:5432/supporit');
  });

pool.on('error', (err) => {
  console.error('❌ Ошибка в пуле подключений PostgreSQL:', err);
});

