import { Router, Response } from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Получить список расходников
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { search, category, page = '1', pageSize = '20' } = req.query;

    let query = 'SELECT * FROM consumables WHERE 1=1';
    const params: any[] = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR model ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    // Подсчет общего количества
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Пагинация
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    query += ` ORDER BY name LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(pageSizeNum, offset);

    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      count: totalCount,
    });
  } catch (error) {
    console.error('Ошибка получения расходников:', error);
    res.status(500).json({ error: 'Ошибка при получении расходников' });
  }
});

// Получить историю выдачи расходников
router.get('/issues', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { consumable_id, issued_to_id, page = '1', pageSize = '20' } = req.query;

    let query = `
      SELECT 
        ci.*,
        c.name as consumable_name,
        c.model as consumable_model,
        c.unit as consumable_unit,
        issued_to.id as issued_to_id,
        issued_to.full_name as issued_to_name,
        issued_to.email as issued_to_email,
        issued_by.id as issued_by_id,
        issued_by.full_name as issued_by_name,
        issued_by.email as issued_by_email
      FROM consumable_issues ci
      JOIN consumables c ON ci.consumable_id = c.id
      LEFT JOIN users issued_to ON ci.issued_to_id = issued_to.id
      LEFT JOIN users issued_by ON ci.issued_by_id = issued_by.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (consumable_id) {
      paramCount++;
      query += ` AND ci.consumable_id = $${paramCount}`;
      params.push(consumable_id);
    }

    if (issued_to_id) {
      paramCount++;
      query += ` AND ci.issued_to_id = $${paramCount}`;
      params.push(issued_to_id);
    }

    // Подсчет общего количества
    const countQuery = query.replace(/SELECT[\s\S]*FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Пагинация
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    query += ` ORDER BY ci.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(pageSizeNum, offset);

    const result = await pool.query(query, params);

    // Преобразуем результаты в нужный формат
    const issues = result.rows.map((row: any) => ({
      id: row.id,
      consumable_id: row.consumable_id,
      consumable: {
        id: row.consumable_id,
        name: row.consumable_name,
        model: row.consumable_model,
        unit: row.consumable_unit,
      },
      quantity: row.quantity,
      issued_to_id: row.issued_to_id,
      issued_to: row.issued_to_id ? {
        id: row.issued_to_id,
        full_name: row.issued_to_name,
        email: row.issued_to_email,
      } : null,
      issued_by_id: row.issued_by_id,
      issued_by: row.issued_by_id ? {
        id: row.issued_by_id,
        full_name: row.issued_by_name,
        email: row.issued_by_email,
      } : null,
      reason: row.reason,
      created_at: row.created_at,
    }));

    res.json({
      data: issues,
      count: totalCount,
    });
  } catch (error) {
    console.error('Ошибка получения истории выдачи расходников:', error);
    res.status(500).json({ error: 'Ошибка при получении истории выдачи расходников' });
  }
});

// Получить расходник по ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM consumables WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Расходник не найден' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка получения расходника:', error);
    res.status(500).json({ error: 'Ошибка при получении расходника' });
  }
});

// Создать расходник
router.post('/', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      model,
      category,
      consumable_type,
      unit = 'шт',
      quantity_in_stock = 0,
      min_quantity = 0,
      cost_per_unit,
      supplier,
      last_purchase_date,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Название обязательно' });
    }

    const result = await pool.query(
      `INSERT INTO consumables (
        name, model, category, consumable_type, unit, quantity_in_stock, min_quantity,
        cost_per_unit, supplier, last_purchase_date, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *`,
      [
        name,
        model || null,
        category || null,
        consumable_type || null,
        unit,
        quantity_in_stock,
        min_quantity,
        cost_per_unit || null,
        supplier || null,
        last_purchase_date || null,
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Ошибка создания расходника:', error);
    res.status(500).json({ 
      error: 'Ошибка при создании расходника',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Обновить расходник
router.put('/:id', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'name', 'model', 'category', 'consumable_type', 'unit', 'quantity_in_stock', 'min_quantity',
      'cost_per_unit', 'supplier', 'last_purchase_date'
    ];

    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        paramCount++;
        if (key === 'quantity_in_stock' || key === 'min_quantity') {
          const value = updates[key];
          if (value === null || value === undefined || value === '') {
            fields.push(`${key} = $${paramCount}::integer`);
            values.push(0);
          } else {
            const numValue = parseFloat(String(value));
            fields.push(`${key} = $${paramCount}::integer`);
            values.push(isNaN(numValue) ? 0 : Math.round(numValue));
          }
        } else if (key === 'cost_per_unit') {
          const value = updates[key];
          if (value === null || value === undefined || value === '') {
            fields.push(`${key} = $${paramCount}::numeric`);
            values.push(null);
          } else {
            const numValue = parseFloat(String(value));
            fields.push(`${key} = $${paramCount}::numeric`);
            values.push(isNaN(numValue) ? null : numValue);
          }
        } else if (key === 'last_purchase_date') {
          fields.push(`${key} = $${paramCount}::date`);
          values.push(updates[key] && updates[key] !== '' ? updates[key] : null);
        } else {
          fields.push(`${key} = $${paramCount}::text`);
          values.push(updates[key] && updates[key] !== '' ? updates[key] : null);
        }
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    fields.push(`updated_at = NOW()`);
    paramCount++;
    values.push(id);

    const query = `UPDATE consumables SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Расходник не найден' });
    }

    res.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Ошибка обновления расходника:', error);
    res.status(500).json({ 
      error: 'Ошибка при обновлении расходника',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Удалить расходник
router.delete('/:id', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM consumables WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Расходник не найден' });
    }

    res.json({ message: 'Расходник удален' });
  } catch (error: any) {
    console.error('Ошибка удаления расходника:', error);
    
    // Проверка на внешние ключи
    if (error.code === '23503') {
      return res.status(400).json({ 
        error: 'Невозможно удалить расходник: он используется в системе' 
      });
    }

    res.status(500).json({ error: 'Ошибка при удалении расходника' });
  }
});

export default router;

