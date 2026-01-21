/**
 * License Service
 * Сервис проверки и управления лицензиями
 */

import crypto from 'crypto';
import os from 'os';
import { pool } from '../config/database.js';

// URL сервера лицензирования (настраивается в .env)
const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'https://license.supporit.ru';
const LICENSE_SECRET = process.env.LICENSE_SECRET || 'default-secret-change-in-production';

// Типы лицензий
export type LicenseTier = 'BASIC' | 'PRO' | 'ENTERPRISE';

export interface LicenseInfo {
  licenseKey: string | null;
  tier: LicenseTier | null;
  validUntil: string | null;
  features: string[];
  isValid: boolean;
  instanceId: string;
}

export interface LicenseValidationResult {
  valid: boolean;
  tier: LicenseTier | null;
  expiresAt: string | null;
  features: string[];
  updateAllowed: boolean;
  maxVersion: string | null;
  message: string;
}

export interface BasicLicenseInfo {
  tier: LicenseTier;
  expiresAt: string | null;
  features: string[];
  hasUpdateFeature: boolean;
}

/**
 * Получить информацию о текущей лицензии из БД
 */
export async function getLicenseInfo(): Promise<LicenseInfo> {
  const result = await pool.query(
    'SELECT license_key, license_type, license_valid_until, instance_id FROM system_info WHERE id = 1'
  );

  if (result.rows.length === 0) {
    return {
      licenseKey: null,
      tier: null,
      validUntil: null,
      features: [],
      isValid: false,
      instanceId: '',
    };
  }

  const row = result.rows[0];
  const isValid = row.license_key &&
    row.license_valid_until &&
    new Date(row.license_valid_until) > new Date();

  return {
    licenseKey: row.license_key ? maskLicenseKey(row.license_key) : null,
    tier: row.license_type,
    validUntil: row.license_valid_until,
    features: getFeaturesByTier(row.license_type),
    isValid,
    instanceId: row.instance_id,
  };
}

/**
 * Сохранить лицензионный ключ
 */
export async function saveLicenseKey(licenseKey: string): Promise<LicenseValidationResult> {
  // Сначала проверяем ключ офлайн
  const basicInfo = validateOffline(licenseKey);

  // Затем проверяем онлайн если возможно
  let onlineResult: LicenseValidationResult | null = null;
  try {
    onlineResult = await validateOnline(licenseKey, '1.0.0');
  } catch (error) {
    console.warn('[License] Онлайн проверка недоступна, используем офлайн валидацию');
  }

  const result = onlineResult || {
    valid: true,
    tier: basicInfo.tier,
    expiresAt: basicInfo.expiresAt,
    features: basicInfo.features,
    updateAllowed: basicInfo.hasUpdateFeature,
    maxVersion: null,
    message: 'Лицензия активирована (офлайн)',
  };

  if (result.valid) {
    // Сохраняем в БД
    await pool.query(
      `UPDATE system_info
       SET license_key = $1,
           license_type = $2,
           license_valid_until = $3
       WHERE id = 1`,
      [licenseKey, result.tier, result.expiresAt]
    );
  }

  return result;
}

/**
 * Проверка лицензии перед обновлением
 */
export async function validateForUpdate(targetVersion: string): Promise<LicenseValidationResult> {
  const result = await pool.query(
    'SELECT license_key, license_type, license_valid_until, instance_id FROM system_info WHERE id = 1'
  );

  if (result.rows.length === 0 || !result.rows[0].license_key) {
    return {
      valid: false,
      tier: null,
      expiresAt: null,
      features: [],
      updateAllowed: false,
      maxVersion: null,
      message: 'Лицензия не активирована',
    };
  }

  const { license_key, instance_id } = result.rows[0];

  // Пробуем онлайн проверку
  try {
    return await validateOnline(license_key, targetVersion, instance_id);
  } catch (error) {
    console.warn('[License] Онлайн проверка недоступна:', error);

    // Fallback на офлайн
    const basicInfo = validateOffline(license_key);

    // Проверяем срок действия
    if (basicInfo.expiresAt) {
      const expiryDate = parseExpiryDate(basicInfo.expiresAt);
      if (expiryDate && expiryDate < new Date()) {
        return {
          valid: false,
          tier: basicInfo.tier,
          expiresAt: basicInfo.expiresAt,
          features: basicInfo.features,
          updateAllowed: false,
          maxVersion: null,
          message: 'Срок действия лицензии истек',
        };
      }
    }

    return {
      valid: basicInfo.hasUpdateFeature,
      tier: basicInfo.tier,
      expiresAt: basicInfo.expiresAt,
      features: basicInfo.features,
      updateAllowed: basicInfo.hasUpdateFeature,
      maxVersion: null,
      message: basicInfo.hasUpdateFeature
        ? 'Обновление разрешено (офлайн проверка)'
        : 'Обновления не включены в лицензию',
    };
  }
}

/**
 * Онлайн проверка лицензии на сервере
 */
async function validateOnline(
  licenseKey: string,
  targetVersion: string,
  instanceId?: string
): Promise<LicenseValidationResult> {
  const systemInfo = await pool.query(
    'SELECT current_version, instance_id FROM system_info WHERE id = 1'
  );

  const currentVersion = systemInfo.rows[0]?.current_version || '1.0.0';
  const instId = instanceId || systemInfo.rows[0]?.instance_id;

  const response = await fetch(`${LICENSE_SERVER_URL}/api/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      licenseKey,
      instanceId: instId,
      currentVersion,
      targetVersion,
      machineId: await getMachineId(),
    }),
    signal: AbortSignal.timeout(10000), // 10 секунд таймаут
  });

  if (!response.ok) {
    throw new Error(`License server error: ${response.status}`);
  }

  return await response.json() as LicenseValidationResult;
}

/**
 * Офлайн проверка формата лицензионного ключа
 * Формат: SUPPORIT-{TIER}-{EXPIRY}-{FEATURES}-{CHECKSUM}
 * Пример: SUPPORIT-PRO-20271231-UPD-A1B2C3D4
 */
export function validateOffline(licenseKey: string): BasicLicenseInfo {
  const parts = licenseKey.split('-');

  if (parts.length < 5 || parts[0] !== 'SUPPORIT') {
    throw new Error('Неверный формат лицензионного ключа');
  }

  const [, tier, expiry, features, checksum] = parts;

  // Проверка типа лицензии
  if (!['BASIC', 'PRO', 'ENTERPRISE'].includes(tier)) {
    throw new Error('Неизвестный тип лицензии');
  }

  // Проверка контрольной суммы
  const data = `SUPPORIT-${tier}-${expiry}-${features}`;
  const expectedChecksum = calculateChecksum(data);

  if (checksum.toUpperCase() !== expectedChecksum) {
    throw new Error('Недействительный лицензионный ключ');
  }

  // Парсим фичи
  const featureList = features.split('+');
  const hasUpdateFeature = featureList.includes('UPD');

  return {
    tier: tier as LicenseTier,
    expiresAt: expiry === 'LIFETIME' ? null : expiry,
    features: featureList,
    hasUpdateFeature,
  };
}

/**
 * Вычисление контрольной суммы для ключа
 */
function calculateChecksum(data: string): string {
  return crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update(data)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
}

/**
 * Генерация лицензионного ключа (для тестирования)
 */
export function generateLicenseKey(
  tier: LicenseTier,
  expiry: string, // YYYYMMDD или LIFETIME
  features: string[] // ['UPD', 'SUP', 'API']
): string {
  const featuresStr = features.join('+');
  const data = `SUPPORIT-${tier}-${expiry}-${featuresStr}`;
  const checksum = calculateChecksum(data);
  return `${data}-${checksum}`;
}

/**
 * Получить уникальный ID машины
 */
async function getMachineId(): Promise<string> {
  const data = [
    os.hostname(),
    os.platform(),
    os.cpus()[0]?.model || 'unknown',
    os.totalmem().toString(),
  ].join('-');

  return crypto
    .createHash('sha256')
    .update(data)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Маскировка ключа для отображения
 */
function maskLicenseKey(key: string): string {
  if (key.length < 20) return '****';
  return key.slice(0, 12) + '****' + key.slice(-4);
}

/**
 * Парсинг даты истечения из формата YYYYMMDD
 */
function parseExpiryDate(expiry: string): Date | null {
  if (expiry === 'LIFETIME' || !expiry) return null;

  const year = parseInt(expiry.slice(0, 4));
  const month = parseInt(expiry.slice(4, 6)) - 1;
  const day = parseInt(expiry.slice(6, 8));

  return new Date(year, month, day, 23, 59, 59);
}

/**
 * Получить список фич по типу лицензии
 */
function getFeaturesByTier(tier: LicenseTier | null): string[] {
  switch (tier) {
    case 'BASIC':
      return ['Базовый функционал'];
    case 'PRO':
      return ['Базовый функционал', 'Обновления', 'Email поддержка'];
    case 'ENTERPRISE':
      return ['Базовый функционал', 'Обновления', 'Приоритетная поддержка', 'API доступ', 'Мультитенант'];
    default:
      return [];
  }
}
