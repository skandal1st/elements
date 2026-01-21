/**
 * Update Service
 * Сервис автоматического обновления системы
 */

import { pool } from '../config/database.js';
import { validateForUpdate } from './license.service.js';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Конфигурация
const GITHUB_REPO = process.env.GITHUB_REPO || 'username/supporit';

// GitHub API types
interface GitHubAsset {
  name: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  published_at: string;
  body: string | null;
  assets: GitHubAsset[];
}
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const PROJECT_DIR = process.env.PROJECT_DIR || '/opt/supporit';
const BACKUP_DIR = process.env.BACKUP_DIR || '/opt/supporit/backups';
const UPDATES_DIR = process.env.UPDATES_DIR || '/tmp/supporit-updates';

// Типы
export type UpdateStatus =
  | 'started'
  | 'downloading'
  | 'backing_up'
  | 'migrating'
  | 'deploying'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export interface SystemInfo {
  currentVersion: string;
  installedAt: string;
  lastUpdateAt: string | null;
  lastUpdateCheck: string | null;
  instanceId: string;
}

export interface AvailableUpdate {
  version: string;
  releaseDate: string;
  changelog: string;
  downloadUrl: string;
  checksum: string;
  breaking: boolean;
  requiresRestart: boolean;
}

export interface UpdateLog {
  id: string;
  fromVersion: string;
  toVersion: string;
  status: UpdateStatus;
  startedAt: string;
  completedAt: string | null;
  performedBy: string | null;
  backupPath: string | null;
  errorMessage: string | null;
}

export interface UpdateProgress {
  status: UpdateStatus;
  progress: number;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Получить информацию о текущей версии системы
 */
export async function getCurrentVersion(): Promise<SystemInfo> {
  const result = await pool.query(
    `SELECT current_version, installed_at, last_update_at, last_update_check, instance_id
     FROM system_info WHERE id = 1`
  );

  if (result.rows.length === 0) {
    // Инициализация если записи нет
    const initResult = await pool.query(
      `INSERT INTO system_info (id, current_version)
       VALUES (1, '1.0.0')
       ON CONFLICT (id) DO UPDATE SET current_version = system_info.current_version
       RETURNING *`
    );
    const row = initResult.rows[0];
    return {
      currentVersion: row.current_version,
      installedAt: row.installed_at,
      lastUpdateAt: row.last_update_at,
      lastUpdateCheck: row.last_update_check,
      instanceId: row.instance_id,
    };
  }

  const row = result.rows[0];
  return {
    currentVersion: row.current_version,
    installedAt: row.installed_at,
    lastUpdateAt: row.last_update_at,
    lastUpdateCheck: row.last_update_check,
    instanceId: row.instance_id,
  };
}

/**
 * Проверить наличие обновлений на GitHub
 */
export async function checkForUpdates(): Promise<AvailableUpdate | null> {
  const systemInfo = await getCurrentVersion();
  const currentVersion = systemInfo.currentVersion;

  // Обновляем время последней проверки
  await pool.query(
    'UPDATE system_info SET last_update_check = NOW() WHERE id = 1'
  );

  try {
    // Запрос к GitHub API для получения последнего релиза
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'SupporIT-Updater',
    };

    if (GITHUB_TOKEN) {
      headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers, signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[Update] Релизы не найдены');
        return null;
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const release = await response.json() as GitHubRelease;
    const latestVersion = release.tag_name.replace(/^v/, '');

    // Сравниваем версии
    if (!isNewerVersion(latestVersion, currentVersion)) {
      console.log(`[Update] Текущая версия ${currentVersion} актуальна`);
      return null;
    }

    // Ищем архив в assets
    const asset = release.assets.find(
      (a) => a.name.endsWith('.tar.gz') || a.name.endsWith('.zip')
    );

    if (!asset) {
      console.warn('[Update] Архив релиза не найден');
      return null;
    }

    // Ищем checksum файл
    const checksumAsset = release.assets.find(
      (a) => a.name.endsWith('.sha256')
    );

    let checksum = '';
    if (checksumAsset) {
      const checksumResponse = await fetch(checksumAsset.browser_download_url, {
        headers,
      });
      if (checksumResponse.ok) {
        checksum = (await checksumResponse.text()).trim().split(' ')[0];
      }
    }

    return {
      version: latestVersion,
      releaseDate: release.published_at,
      changelog: release.body || '',
      downloadUrl: asset.browser_download_url,
      checksum,
      breaking: release.body?.toLowerCase().includes('breaking') || false,
      requiresRestart: true,
    };
  } catch (error) {
    console.error('[Update] Ошибка проверки обновлений:', error);
    throw error;
  }
}

/**
 * Начать процесс обновления
 */
export async function startUpdate(
  targetVersion: string,
  downloadUrl: string,
  userId: string
): Promise<string> {
  // Проверяем лицензию
  const licenseCheck = await validateForUpdate(targetVersion);
  if (!licenseCheck.valid || !licenseCheck.updateAllowed) {
    throw new Error(licenseCheck.message || 'Обновление не разрешено лицензией');
  }

  // Получаем текущую версию
  const systemInfo = await getCurrentVersion();

  // Создаем запись в логах
  const result = await pool.query(
    `INSERT INTO update_logs (from_version, to_version, status, performed_by)
     VALUES ($1, $2, 'started', $3)
     RETURNING id`,
    [systemInfo.currentVersion, targetVersion, userId]
  );

  const updateId = result.rows[0].id;

  // Запускаем обновление в фоне
  processUpdate(updateId, targetVersion, downloadUrl).catch((error) => {
    console.error('[Update] Критическая ошибка:', error);
    updateStatus(updateId, 'failed', error.message);
  });

  return updateId;
}

/**
 * Процесс обновления (фоновый)
 */
async function processUpdate(
  updateId: string,
  targetVersion: string,
  downloadUrl: string
): Promise<void> {
  console.log(`[Update] Начало обновления ${updateId} до версии ${targetVersion}`);

  try {
    // 1. Скачивание
    await updateStatus(updateId, 'downloading', 'Скачивание обновления...');
    const archivePath = await downloadRelease(downloadUrl, targetVersion);

    // 2. Backup
    await updateStatus(updateId, 'backing_up', 'Создание резервной копии...');
    const backupPath = await createBackup();
    await pool.query(
      'UPDATE update_logs SET backup_path = $1 WHERE id = $2',
      [backupPath, updateId]
    );

    // 3. Запуск скрипта обновления
    await updateStatus(updateId, 'deploying', 'Развертывание обновления...');
    await executeUpdateScript(archivePath, backupPath);

    // 4. Обновление версии в БД
    await pool.query(
      `UPDATE system_info
       SET current_version = $1, last_update_at = NOW()
       WHERE id = 1`,
      [targetVersion]
    );

    // 5. Завершение
    await updateStatus(updateId, 'completed', 'Обновление успешно завершено');

    console.log(`[Update] Обновление ${updateId} завершено успешно`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error(`[Update] Ошибка обновления ${updateId}:`, error);
    await updateStatus(updateId, 'failed', errorMsg);
    throw error;
  }
}

/**
 * Скачать релиз
 */
async function downloadRelease(url: string, version: string): Promise<string> {
  await fs.mkdir(UPDATES_DIR, { recursive: true });

  const archivePath = path.join(UPDATES_DIR, `supporit-v${version}.tar.gz`);

  console.log(`[Update] Скачивание ${url}`);

  const headers: Record<string, string> = {
    'User-Agent': 'SupporIT-Updater',
  };

  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    headers['Accept'] = 'application/octet-stream';
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Ошибка скачивания: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  await fs.writeFile(archivePath, Buffer.from(buffer));

  console.log(`[Update] Файл сохранен: ${archivePath}`);

  return archivePath;
}

/**
 * Создать резервную копию
 */
async function createBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}`);

  await fs.mkdir(backupPath, { recursive: true });

  console.log(`[Update] Создание backup в ${backupPath}`);

  // Backup выполняется через update.sh скрипт
  return backupPath;
}

/**
 * Выполнить скрипт обновления
 */
async function executeUpdateScript(
  archivePath: string,
  backupPath: string
): Promise<void> {
  const scriptPath = path.join(PROJECT_DIR, 'scripts', 'update.sh');

  return new Promise((resolve, reject) => {
    const child = spawn('sudo', [scriptPath, archivePath, backupPath], {
      cwd: PROJECT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      console.log(`[Update Script] ${data.toString().trim()}`);
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      console.error(`[Update Script Error] ${data.toString().trim()}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Скрипт завершился с кодом ${code}: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Ошибка запуска скрипта: ${error.message}`));
    });
  });
}

/**
 * Обновить статус обновления
 */
async function updateStatus(
  updateId: string,
  status: UpdateStatus,
  message: string
): Promise<void> {
  const details = { message, timestamp: new Date().toISOString() };

  await pool.query(
    `UPDATE update_logs
     SET status = $1,
         details = COALESCE(details, '{}'::jsonb) || $2::jsonb,
         error_message = CASE WHEN $1 = 'failed' THEN $3 ELSE error_message END
     WHERE id = $4`,
    [status, JSON.stringify(details), message, updateId]
  );

  console.log(`[Update] Статус ${updateId}: ${status} - ${message}`);
}

/**
 * Получить статус обновления
 */
export async function getUpdateStatus(updateId: string): Promise<UpdateProgress> {
  const result = await pool.query(
    `SELECT status, details, error_message FROM update_logs WHERE id = $1`,
    [updateId]
  );

  if (result.rows.length === 0) {
    throw new Error('Обновление не найдено');
  }

  const row = result.rows[0];
  const statusProgress: Record<UpdateStatus, number> = {
    started: 10,
    downloading: 30,
    backing_up: 50,
    migrating: 70,
    deploying: 90,
    completed: 100,
    failed: 0,
    rolled_back: 0,
  };

  return {
    status: row.status,
    progress: statusProgress[row.status as UpdateStatus] || 0,
    message: row.details?.message || row.error_message || '',
    details: row.details,
  };
}

/**
 * Откат обновления
 */
export async function rollbackUpdate(updateId: string): Promise<void> {
  const result = await pool.query(
    `SELECT backup_path, from_version, status FROM update_logs WHERE id = $1`,
    [updateId]
  );

  if (result.rows.length === 0) {
    throw new Error('Обновление не найдено');
  }

  const { backup_path, from_version, status } = result.rows[0];

  if (status === 'rolled_back') {
    throw new Error('Обновление уже откачено');
  }

  if (!backup_path) {
    throw new Error('Резервная копия не найдена');
  }

  console.log(`[Update] Откат обновления ${updateId}`);

  // Выполняем скрипт отката
  const scriptPath = path.join(PROJECT_DIR, 'scripts', 'rollback.sh');

  return new Promise((resolve, reject) => {
    const child = spawn('sudo', [scriptPath, backup_path], {
      cwd: PROJECT_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.on('close', async (code) => {
      if (code === 0) {
        // Обновляем версию в БД
        await pool.query(
          `UPDATE system_info SET current_version = $1 WHERE id = 1`,
          [from_version]
        );
        await pool.query(
          `UPDATE update_logs SET status = 'rolled_back' WHERE id = $1`,
          [updateId]
        );
        resolve();
      } else {
        reject(new Error(`Откат завершился с кодом ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Получить историю обновлений
 */
export async function getUpdateHistory(limit = 20): Promise<UpdateLog[]> {
  const result = await pool.query(
    `SELECT ul.id, ul.from_version, ul.to_version, ul.status,
            ul.started_at, ul.completed_at, ul.backup_path, ul.error_message,
            u.full_name as performed_by
     FROM update_logs ul
     LEFT JOIN users u ON ul.performed_by = u.id
     ORDER BY ul.started_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    fromVersion: row.from_version,
    toVersion: row.to_version,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    performedBy: row.performed_by,
    backupPath: row.backup_path,
    errorMessage: row.error_message,
  }));
}

/**
 * Сравнение версий (semver)
 */
function isNewerVersion(newVersion: string, currentVersion: string): boolean {
  const parseVersion = (v: string) => v.split('.').map((n) => parseInt(n) || 0);

  const newParts = parseVersion(newVersion);
  const currentParts = parseVersion(currentVersion);

  for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
    const newPart = newParts[i] || 0;
    const currentPart = currentParts[i] || 0;

    if (newPart > currentPart) return true;
    if (newPart < currentPart) return false;
  }

  return false;
}

/**
 * Проверка checksum файла
 */
export async function verifyChecksum(
  filePath: string,
  expectedChecksum: string
): Promise<boolean> {
  if (!expectedChecksum) return true;

  const fileBuffer = await fs.readFile(filePath);
  const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  return hash.toLowerCase() === expectedChecksum.toLowerCase();
}
