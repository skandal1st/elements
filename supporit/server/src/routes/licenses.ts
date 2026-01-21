import { Router, Response } from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Получить список лицензий
router.get('/', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      expired,
      page = '1',
      pageSize = '50'
    } = req.query;

    let query = `
      SELECT
        l.*,
        (l.total_licenses - l.used_licenses) as available_licenses
      FROM software_licenses l
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (search) {
      paramCount++;
      query += ` AND (l.software_name ILIKE $${paramCount} OR l.vendor ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    if (expired === 'true') {
      query += ` AND l.expires_at < CURRENT_DATE`;
    } else if (expired === 'false') {
      query += ` AND (l.expires_at IS NULL OR l.expires_at >= CURRENT_DATE)`;
    }

    // Подсчет общего количества
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Пагинация
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    query += ` ORDER BY l.software_name ASC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(pageSizeNum, offset);

    const result = await pool.query(query, params);

    res.json({
      data: result.rows,
      count: totalCount,
    });
  } catch (error) {
    console.error('Ошибка получения лицензий:', error);
    res.status(500).json({ error: 'Ошибка при получении лицензий' });
  }
});

// Получить лицензию по ID
router.get('/:id', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT
        l.*,
        (l.total_licenses - l.used_licenses) as available_licenses
       FROM software_licenses l
       WHERE l.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Лицензия не найдена' });
    }

    // Загружаем привязки лицензий
    const assignmentsResult = await pool.query(
      `SELECT
        la.*,
        u.full_name as user_name,
        u.email as user_email,
        e.name as equipment_name,
        e.inventory_number as equipment_inventory_number
       FROM license_assignments la
       LEFT JOIN users u ON la.user_id = u.id
       LEFT JOIN equipment e ON la.equipment_id = e.id
       WHERE la.license_id = $1 AND la.released_at IS NULL
       ORDER BY la.assigned_at DESC`,
      [id]
    );

    res.json({
      data: {
        ...result.rows[0],
        assignments: assignmentsResult.rows,
      },
    });
  } catch (error) {
    console.error('Ошибка получения лицензии:', error);
    res.status(500).json({ error: 'Ошибка при получении лицензии' });
  }
});

// Создать лицензию
router.post('/', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const {
      software_name,
      vendor,
      license_type,
      license_key,
      total_licenses = 1,
      expires_at,
      cost,
      purchase_date,
      notes,
    } = req.body;

    if (!software_name) {
      return res.status(400).json({ error: 'Название ПО обязательно' });
    }

    const result = await pool.query(
      `INSERT INTO software_licenses (
        software_name, vendor, license_type, license_key, total_licenses,
        expires_at, cost, purchase_date, notes, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
      [
        software_name,
        vendor || null,
        license_type || null,
        license_key || null,
        total_licenses,
        expires_at || null,
        cost || null,
        purchase_date || null,
        notes || null,
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка создания лицензии:', error);
    res.status(500).json({ error: 'Ошибка при создании лицензии' });
  }
});

// Обновить лицензию
router.put('/:id', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = [
      'software_name',
      'vendor',
      'license_type',
      'license_key',
      'total_licenses',
      'expires_at',
      'cost',
      'purchase_date',
      'notes',
    ];

    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key)) {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    fields.push(`updated_at = NOW()`);
    paramCount++;
    values.push(id);

    const query = `UPDATE software_licenses SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Лицензия не найдена' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка обновления лицензии:', error);
    res.status(500).json({ error: 'Ошибка при обновлении лицензии' });
  }
});

// Удалить лицензию
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM software_licenses WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Лицензия не найдена' });
    }

    res.json({ message: 'Лицензия удалена' });
  } catch (error) {
    console.error('Ошибка удаления лицензии:', error);
    res.status(500).json({ error: 'Ошибка при удалении лицензии' });
  }
});

// Назначить лицензию пользователю или оборудованию
router.post('/:id/assign', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { user_id, equipment_id } = req.body;

    if (!user_id && !equipment_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Укажите пользователя или оборудование' });
    }

    // Проверяем лицензию
    const licenseResult = await client.query(
      'SELECT * FROM software_licenses WHERE id = $1',
      [id]
    );

    if (licenseResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Лицензия не найдена' });
    }

    const license = licenseResult.rows[0];

    // Проверяем доступность
    if (license.used_licenses >= license.total_licenses) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Нет доступных лицензий' });
    }

    // Создаем назначение
    const assignmentResult = await client.query(
      `INSERT INTO license_assignments (license_id, user_id, equipment_id, assigned_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [id, user_id || null, equipment_id || null]
    );

    // Увеличиваем счетчик использованных лицензий
    await client.query(
      'UPDATE software_licenses SET used_licenses = used_licenses + 1, updated_at = NOW() WHERE id = $1',
      [id]
    );

    await client.query('COMMIT');

    res.status(201).json({ data: assignmentResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка назначения лицензии:', error);
    res.status(500).json({ error: 'Ошибка при назначении лицензии' });
  } finally {
    client.release();
  }
});

// Освободить лицензию
router.post('/:id/release/:assignmentId', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id, assignmentId } = req.params;

    // Проверяем привязку
    const assignmentResult = await client.query(
      'SELECT * FROM license_assignments WHERE id = $1 AND license_id = $2 AND released_at IS NULL',
      [assignmentId, id]
    );

    if (assignmentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Привязка не найдена' });
    }

    // Освобождаем лицензию
    await client.query(
      'UPDATE license_assignments SET released_at = NOW() WHERE id = $1',
      [assignmentId]
    );

    // Уменьшаем счетчик использованных лицензий
    await client.query(
      'UPDATE software_licenses SET used_licenses = GREATEST(used_licenses - 1, 0), updated_at = NOW() WHERE id = $1',
      [id]
    );

    await client.query('COMMIT');

    res.json({ message: 'Лицензия освобождена' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка освобождения лицензии:', error);
    res.status(500).json({ error: 'Ошибка при освобождении лицензии' });
  } finally {
    client.release();
  }
});

export default router;
