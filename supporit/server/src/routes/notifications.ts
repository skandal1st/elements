import { Router, Response } from 'express';
import { pool } from '../config/database.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

// GET /api/notifications - получить уведомления текущего пользователя
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    const { unread_only, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT * FROM notifications
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (unread_only === 'true') {
      query += ' AND is_read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const result = await pool.query(query, params);

    // Получаем количество непрочитанных
    const unreadResult = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({
      data: result.rows,
      unread_count: parseInt(unreadResult.rows[0].count),
      total: result.rows.length,
    });
  } catch (error) {
    console.error('[Notifications API] Ошибка получения уведомлений:', error);
    res.status(500).json({ error: 'Ошибка при получении уведомлений' });
  }
});

// GET /api/notifications/unread-count - получить количество непрочитанных
router.get('/unread-count', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const result = await pool.query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({
      count: parseInt(result.rows[0].count),
    });
  } catch (error) {
    console.error('[Notifications API] Ошибка получения счетчика:', error);
    res.status(500).json({ error: 'Ошибка при получении счетчика' });
  }
});

// PUT /api/notifications/:id/read - отметить как прочитанное
router.put('/:id/read', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Проверяем, что уведомление принадлежит пользователю
    const checkResult = await pool.query(
      'SELECT id FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Уведомление не найдено' });
    }

    const result = await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *',
      [id]
    );

    res.json({
      message: 'Уведомление отмечено как прочитанное',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Notifications API] Ошибка обновления уведомления:', error);
    res.status(500).json({ error: 'Ошибка при обновлении уведомления' });
  }
});

// PUT /api/notifications/read-all - отметить все как прочитанные
router.put('/read-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
      [userId]
    );

    res.json({
      message: 'Все уведомления отмечены как прочитанные',
    });
  } catch (error) {
    console.error('[Notifications API] Ошибка обновления уведомлений:', error);
    res.status(500).json({ error: 'Ошибка при обновлении уведомлений' });
  }
});

// DELETE /api/notifications/:id - удалить уведомление
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    // Проверяем, что уведомление принадлежит пользователю
    const result = await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Уведомление не найдено' });
    }

    res.json({
      message: 'Уведомление удалено',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Notifications API] Ошибка удаления уведомления:', error);
    res.status(500).json({ error: 'Ошибка при удалении уведомления' });
  }
});

// DELETE /api/notifications/clear-all - удалить все прочитанные уведомления
router.delete('/clear-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const result = await pool.query(
      'DELETE FROM notifications WHERE user_id = $1 AND is_read = true',
      [userId]
    );

    res.json({
      message: 'Прочитанные уведомления удалены',
      deleted_count: result.rowCount,
    });
  } catch (error) {
    console.error('[Notifications API] Ошибка очистки уведомлений:', error);
    res.status(500).json({ error: 'Ошибка при очистке уведомлений' });
  }
});

export default router;
