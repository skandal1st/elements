import { Router, Response } from 'express';
import { pool } from '../config/database.js';
import { authenticate, AuthRequest, requireRole } from '../middleware/auth.js';
import { z } from 'zod';

const router = Router();

// Схема валидации для создания элемента справочника
const createDictionarySchema = z.object({
  dictionary_type: z.enum([
    'ticket_category',
    'ticket_priority',
    'ticket_status',
    'equipment_category',
    'equipment_status',
    'consumable_type'
  ]),
  key: z.string().min(1).regex(/^[a-z_]+$/, 'Ключ должен содержать только латиницу и _'),
  label: z.string().min(1),
  color: z.string().optional(),
  icon: z.string().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

// Схема валидации для обновления элемента справочника
const updateDictionarySchema = z.object({
  label: z.string().min(1).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

// GET /api/dictionaries - получить справочники (опционально фильтр по типу)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { type } = req.query;

    let query = 'SELECT * FROM dictionaries';
    const params: any[] = [];

    if (type) {
      query += ' WHERE dictionary_type = $1';
      params.push(type);
    }

    query += ' ORDER BY dictionary_type, sort_order, label';

    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('[Dictionaries API] Ошибка получения справочников:', error);
    res.status(500).json({ error: 'Ошибка при получении справочников' });
  }
});

// GET /api/dictionaries/:type/:key - получить конкретный элемент
router.get('/:type/:key', async (req: AuthRequest, res: Response) => {
  try {
    const { type, key } = req.params;

    const result = await pool.query(
      'SELECT * FROM dictionaries WHERE dictionary_type = $1 AND key = $2',
      [type, key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Элемент справочника не найден' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('[Dictionaries API] Ошибка получения элемента:', error);
    res.status(500).json({ error: 'Ошибка при получении элемента справочника' });
  }
});

// POST /api/dictionaries - создать новый элемент (только admin)
router.post('/', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const data = createDictionarySchema.parse(req.body);

    // Проверяем уникальность ключа
    const existing = await pool.query(
      'SELECT id FROM dictionaries WHERE dictionary_type = $1 AND key = $2',
      [data.dictionary_type, data.key]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Элемент с таким ключом уже существует в этом справочнике' });
    }

    // Создаем новый элемент
    const result = await pool.query(
      `INSERT INTO dictionaries (dictionary_type, key, label, color, icon, sort_order, is_active, is_system)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false)
       RETURNING *`,
      [
        data.dictionary_type,
        data.key,
        data.label,
        data.color || null,
        data.icon || null,
        data.sort_order !== undefined ? data.sort_order : 0,
        data.is_active !== undefined ? data.is_active : true,
      ]
    );

    res.status(201).json({
      message: 'Элемент справочника создан',
      data: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Неверные данные', details: error.errors });
    }
    console.error('[Dictionaries API] Ошибка создания элемента:', error);
    res.status(500).json({ error: 'Ошибка при создании элемента справочника' });
  }
});

// PUT /api/dictionaries/:id - обновить элемент (только admin)
router.put('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateDictionarySchema.parse(req.body);

    // Проверяем существование элемента
    const existing = await pool.query(
      'SELECT * FROM dictionaries WHERE id = $1',
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Элемент справочника не найден' });
    }

    const item = existing.rows[0];

    // Для системных элементов разрешаем менять только label, color, icon
    if (item.is_system) {
      if (data.sort_order !== undefined || data.is_active !== undefined) {
        return res.status(400).json({
          error: 'Для системных элементов можно изменять только название, цвет и иконку'
        });
      }
    }

    // Собираем поля для обновления
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.label !== undefined) {
      updates.push(`label = $${paramIndex++}`);
      values.push(data.label);
    }
    if (data.color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(data.color);
    }
    if (data.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(data.icon);
    }
    if (data.sort_order !== undefined && !item.is_system) {
      updates.push(`sort_order = $${paramIndex++}`);
      values.push(data.sort_order);
    }
    if (data.is_active !== undefined && !item.is_system) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE dictionaries SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    res.json({
      message: 'Элемент справочника обновлен',
      data: result.rows[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Неверные данные', details: error.errors });
    }
    console.error('[Dictionaries API] Ошибка обновления элемента:', error);
    res.status(500).json({ error: 'Ошибка при обновлении элемента справочника' });
  }
});

// DELETE /api/dictionaries/:id - удалить элемент (только admin, только не системные)
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Получаем информацию о элементе
    const dictResult = await pool.query(
      'SELECT dictionary_type, key, is_system FROM dictionaries WHERE id = $1',
      [id]
    );

    if (dictResult.rows.length === 0) {
      return res.status(404).json({ error: 'Элемент справочника не найден' });
    }

    const { dictionary_type, key, is_system } = dictResult.rows[0];

    // Системные элементы нельзя удалять
    if (is_system) {
      return res.status(400).json({
        error: 'Системные элементы нельзя удалить. Деактивируйте элемент вместо удаления.'
      });
    }

    // Проверяем использование элемента в зависимости от типа
    let usageCount = 0;
    let tableName = '';

    if (dictionary_type === 'ticket_category') {
      const usage = await pool.query('SELECT COUNT(*) FROM tickets WHERE category = $1', [key]);
      usageCount = parseInt(usage.rows[0].count);
      tableName = 'тикетах';
    } else if (dictionary_type === 'ticket_priority') {
      const usage = await pool.query('SELECT COUNT(*) FROM tickets WHERE priority = $1', [key]);
      usageCount = parseInt(usage.rows[0].count);
      tableName = 'тикетах';
    } else if (dictionary_type === 'ticket_status') {
      const usage = await pool.query('SELECT COUNT(*) FROM tickets WHERE status = $1', [key]);
      usageCount = parseInt(usage.rows[0].count);
      tableName = 'тикетах';
    } else if (dictionary_type === 'equipment_category') {
      const usage = await pool.query('SELECT COUNT(*) FROM equipment WHERE category = $1', [key]);
      usageCount = parseInt(usage.rows[0].count);
      tableName = 'оборудовании';
    } else if (dictionary_type === 'equipment_status') {
      const usage = await pool.query('SELECT COUNT(*) FROM equipment WHERE status = $1', [key]);
      usageCount = parseInt(usage.rows[0].count);
      tableName = 'оборудовании';
    }

    // Если элемент используется, запрещаем удаление
    if (usageCount > 0) {
      return res.status(400).json({
        error: `Невозможно удалить: элемент используется в ${usageCount} записях в ${tableName}. Деактивируйте элемент вместо удаления.`
      });
    }

    // Удаляем элемент
    await pool.query('DELETE FROM dictionaries WHERE id = $1', [id]);

    res.json({ message: 'Элемент справочника удален' });
  } catch (error) {
    console.error('[Dictionaries API] Ошибка удаления элемента:', error);
    res.status(500).json({ error: 'Ошибка при удалении элемента справочника' });
  }
});

export default router;
