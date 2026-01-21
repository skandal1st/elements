/**
 * Updates API Routes
 * API для управления обновлениями системы
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { z } from 'zod';
import {
  getCurrentVersion,
  checkForUpdates,
  startUpdate,
  getUpdateStatus,
  getUpdateHistory,
  rollbackUpdate,
} from '../services/update.service.js';
import {
  getLicenseInfo,
  saveLicenseKey,
  validateForUpdate,
  validateOffline,
} from '../services/license.service.js';

const router = Router();

// Все роуты требуют аутентификации и роль admin
router.use(authenticate);
router.use(requireRole('admin'));

// Схемы валидации
const startUpdateSchema = z.object({
  version: z.string().min(1),
  downloadUrl: z.string().url(),
});

const saveLicenseSchema = z.object({
  licenseKey: z.string().min(10),
});

/**
 * GET /api/updates/info
 * Получить информацию о системе и лицензии
 */
router.get('/info', async (req: AuthRequest, res: Response) => {
  try {
    const [systemInfo, licenseInfo] = await Promise.all([
      getCurrentVersion(),
      getLicenseInfo(),
    ]);

    res.json({
      data: {
        system: systemInfo,
        license: licenseInfo,
      },
    });
  } catch (error) {
    console.error('[Updates API] Ошибка получения информации:', error);
    res.status(500).json({ error: 'Ошибка получения информации о системе' });
  }
});

/**
 * GET /api/updates/check
 * Проверить наличие обновлений
 */
router.get('/check', async (req: AuthRequest, res: Response) => {
  try {
    const update = await checkForUpdates();

    if (!update) {
      return res.json({
        data: {
          available: false,
          message: 'Система обновлена до последней версии',
        },
      });
    }

    // Проверяем разрешено ли обновление по лицензии
    const licenseCheck = await validateForUpdate(update.version);

    res.json({
      data: {
        available: true,
        update,
        licenseAllowed: licenseCheck.updateAllowed,
        licenseMessage: licenseCheck.message,
      },
    });
  } catch (error) {
    console.error('[Updates API] Ошибка проверки обновлений:', error);
    res.status(500).json({ error: 'Ошибка проверки обновлений' });
  }
});

/**
 * POST /api/updates/start
 * Начать обновление
 */
router.post('/start', async (req: AuthRequest, res: Response) => {
  try {
    const validation = startUpdateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Неверные параметры',
        details: validation.error.errors,
      });
    }

    const { version, downloadUrl } = validation.data;
    const userId = req.userId!;

    // Проверяем лицензию
    const licenseCheck = await validateForUpdate(version);
    if (!licenseCheck.updateAllowed) {
      return res.status(403).json({
        error: licenseCheck.message || 'Обновление не разрешено лицензией',
      });
    }

    const updateId = await startUpdate(version, downloadUrl, userId);

    res.json({
      data: {
        updateId,
        message: 'Обновление запущено',
      },
    });
  } catch (error) {
    console.error('[Updates API] Ошибка запуска обновления:', error);
    const message = error instanceof Error ? error.message : 'Ошибка запуска обновления';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/updates/status/:id
 * Получить статус обновления
 */
router.get('/status/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const status = await getUpdateStatus(id);

    res.json({ data: status });
  } catch (error) {
    console.error('[Updates API] Ошибка получения статуса:', error);
    const message = error instanceof Error ? error.message : 'Ошибка получения статуса';
    res.status(404).json({ error: message });
  }
});

/**
 * POST /api/updates/rollback/:id
 * Откатить обновление
 */
router.post('/rollback/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await rollbackUpdate(id);

    res.json({
      data: {
        success: true,
        message: 'Откат выполнен успешно',
      },
    });
  } catch (error) {
    console.error('[Updates API] Ошибка отката:', error);
    const message = error instanceof Error ? error.message : 'Ошибка отката';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/updates/history
 * История обновлений
 */
router.get('/history', async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = await getUpdateHistory(limit);

    res.json({ data: history });
  } catch (error) {
    console.error('[Updates API] Ошибка получения истории:', error);
    res.status(500).json({ error: 'Ошибка получения истории обновлений' });
  }
});

/**
 * GET /api/updates/license
 * Получить информацию о лицензии
 */
router.get('/license', async (req: AuthRequest, res: Response) => {
  try {
    const licenseInfo = await getLicenseInfo();
    res.json({ data: licenseInfo });
  } catch (error) {
    console.error('[Updates API] Ошибка получения лицензии:', error);
    res.status(500).json({ error: 'Ошибка получения информации о лицензии' });
  }
});

/**
 * POST /api/updates/license
 * Сохранить лицензионный ключ
 */
router.post('/license', async (req: AuthRequest, res: Response) => {
  try {
    const validation = saveLicenseSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Неверный формат лицензионного ключа',
      });
    }

    const { licenseKey } = validation.data;

    // Сначала проверяем формат офлайн
    try {
      validateOffline(licenseKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Неверный ключ';
      return res.status(400).json({ error: message });
    }

    // Сохраняем и активируем
    const result = await saveLicenseKey(licenseKey);

    if (!result.valid) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      data: {
        success: true,
        message: result.message,
        license: {
          tier: result.tier,
          expiresAt: result.expiresAt,
          features: result.features,
        },
      },
    });
  } catch (error) {
    console.error('[Updates API] Ошибка сохранения лицензии:', error);
    const message = error instanceof Error ? error.message : 'Ошибка активации лицензии';
    res.status(500).json({ error: message });
  }
});

export default router;
