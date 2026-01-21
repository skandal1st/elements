import crypto from 'crypto';

// Ключ шифрования из переменных окружения (должен быть 32 байта)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'change-me-32-bytes-key-here!!!!!';
const IV_LENGTH = 16; // Для AES, длина IV всегда 16 байт

/**
 * Шифрует текст используя AES-256-CBC
 * @param text Текст для шифрования
 * @returns Зашифрованная строка в формате iv:encrypted
 */
export function encrypt(text: string): string {
  if (!text) {
    return '';
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)), // Обрезаем до 32 байт
      iv
    );

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Возвращаем iv и зашифрованный текст, разделенные двоеточием
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Ошибка шифрования:', error);
    throw new Error('Не удалось зашифровать данные');
  }
}

/**
 * Расшифровывает текст, зашифрованный функцией encrypt
 * @param text Зашифрованная строка в формате iv:encrypted
 * @returns Расшифрованный текст
 */
export function decrypt(text: string): string {
  if (!text) {
    return '';
  }

  try {
    const parts = text.split(':');
    if (parts.length !== 2) {
      throw new Error('Неверный формат зашифрованных данных');
    }

    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');

    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)), // Обрезаем до 32 байт
      iv
    );

    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    console.error('Ошибка расшифровки:', error);
    throw new Error('Не удалось расшифровать данные');
  }
}

/**
 * Проверяет, установлен ли корректный ключ шифрования
 * @returns true если ключ установлен, false если используется default
 */
export function isEncryptionKeySet(): boolean {
  return ENCRYPTION_KEY !== 'change-me-32-bytes-key-here!!!!!';
}

/**
 * Генерирует случайный ключ шифрования
 * @returns Ключ в формате hex (64 символа = 32 байта)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}
