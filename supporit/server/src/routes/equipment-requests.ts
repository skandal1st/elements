import { Router, Response } from 'express';
import { pool } from '../config/database.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Получить список заявок (с пагинацией и фильтрами)
// Employees видят только свои заявки, IT/Admin видят все
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      search,
      status,
      urgency,
      category,
      request_type,
      requester_id,
      page = '1',
      pageSize = '20',
    } = req.query;

    let query = `
      SELECT
        er.*,
        u_req.full_name as requester_name,
        u_req.email as requester_email,
        u_req.department as requester_department,
        u_rev.full_name as reviewer_name,
        eq_replace.name as replace_equipment_name,
        eq_replace.inventory_number as replace_equipment_inventory,
        eq_issued.name as issued_equipment_name,
        eq_issued.inventory_number as issued_equipment_inventory
      FROM equipment_requests er
      LEFT JOIN users u_req ON er.requester_id = u_req.id
      LEFT JOIN users u_rev ON er.reviewer_id = u_rev.id
      LEFT JOIN equipment eq_replace ON er.replace_equipment_id = eq_replace.id
      LEFT JOIN equipment eq_issued ON er.issued_equipment_id = eq_issued.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    // Employees видят только свои заявки
    if (req.userRole === 'employee') {
      paramCount++;
      query += ` AND er.requester_id = $${paramCount}`;
      params.push(req.userId);
    } else if (requester_id) {
      // IT/Admin могут фильтровать по заявителю
      paramCount++;
      query += ` AND er.requester_id = $${paramCount}`;
      params.push(requester_id);
    }

    // Фильтр по статусу
    if (status) {
      paramCount++;
      query += ` AND er.status = $${paramCount}`;
      params.push(status);
    }

    // Фильтр по срочности
    if (urgency) {
      paramCount++;
      query += ` AND er.urgency = $${paramCount}`;
      params.push(urgency);
    }

    // Фильтр по категории
    if (category) {
      paramCount++;
      query += ` AND er.equipment_category = $${paramCount}`;
      params.push(category);
    }

    // Фильтр по типу заявки
    if (request_type) {
      paramCount++;
      query += ` AND er.request_type = $${paramCount}`;
      params.push(request_type);
    }

    // Поиск по названию и описанию
    if (search) {
      paramCount++;
      query += ` AND (er.title ILIKE $${paramCount} OR er.description ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Считаем общее количество
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM');
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Сортировка и пагинация
    query += ' ORDER BY er.created_at DESC';
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(pageSizeNum);

    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await pool.query(query, params);

    res.json({ data: result.rows, count: totalCount });
  } catch (error) {
    console.error('Ошибка получения заявок на оборудование:', error);
    res.status(500).json({ error: 'Ошибка при получении заявок' });
  }
});

// Получить список для закупок (одобренные заявки)
router.get('/procurement-list', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        er.*,
        u_req.full_name as requester_name,
        u_req.department as requester_department,
        u_rev.full_name as reviewer_name
      FROM equipment_requests er
      LEFT JOIN users u_req ON er.requester_id = u_req.id
      LEFT JOIN users u_rev ON er.reviewer_id = u_rev.id
      WHERE er.status IN ('approved', 'ordered')
      ORDER BY er.urgency DESC, er.reviewed_at ASC
    `);

    // Группируем по категории для удобства
    const grouped = result.rows.reduce((acc: any, row: any) => {
      const cat = row.equipment_category;
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push(row);
      return acc;
    }, {});

    res.json({
      data: result.rows,
      grouped,
      totalCost: result.rows.reduce((sum: number, r: any) => sum + (parseFloat(r.estimated_cost) || 0), 0)
    });
  } catch (error) {
    console.error('Ошибка получения списка закупок:', error);
    res.status(500).json({ error: 'Ошибка при получении списка закупок' });
  }
});

// Получить заявку по ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        er.*,
        u_req.full_name as requester_name,
        u_req.email as requester_email,
        u_req.department as requester_department,
        u_rev.full_name as reviewer_name,
        eq_replace.name as replace_equipment_name,
        eq_replace.inventory_number as replace_equipment_inventory,
        eq_issued.name as issued_equipment_name,
        eq_issued.inventory_number as issued_equipment_inventory
      FROM equipment_requests er
      LEFT JOIN users u_req ON er.requester_id = u_req.id
      LEFT JOIN users u_rev ON er.reviewer_id = u_rev.id
      LEFT JOIN equipment eq_replace ON er.replace_equipment_id = eq_replace.id
      LEFT JOIN equipment eq_issued ON er.issued_equipment_id = eq_issued.id
      WHERE er.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const request = result.rows[0];

    // Employees могут видеть только свои заявки
    if (req.userRole === 'employee' && request.requester_id !== req.userId) {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    res.json({ data: request });
  } catch (error) {
    console.error('Ошибка получения заявки:', error);
    res.status(500).json({ error: 'Ошибка при получении заявки' });
  }
});

// Создать заявку (доступно всем)
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      title,
      description,
      equipment_category,
      request_type = 'new',
      quantity = 1,
      urgency = 'normal',
      justification,
      replace_equipment_id,
      estimated_cost,
    } = req.body;

    // Валидация
    if (!title || !equipment_category) {
      return res.status(400).json({ error: 'Название и категория обязательны' });
    }

    const result = await pool.query(
      `INSERT INTO equipment_requests (
        title, description, equipment_category, request_type, quantity,
        urgency, justification, requester_id, replace_equipment_id, estimated_cost
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        title,
        description || null,
        equipment_category,
        request_type,
        quantity,
        urgency,
        justification || null,
        req.userId,
        replace_equipment_id || null,
        estimated_cost ? parseFloat(estimated_cost) : null,
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка создания заявки:', error);
    res.status(500).json({ error: 'Ошибка при создании заявки' });
  }
});

// Обновить заявку
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      equipment_category,
      request_type,
      quantity,
      urgency,
      justification,
      replace_equipment_id,
      estimated_cost,
      status,
      ordered_at,
      received_at,
      issued_at,
      issued_equipment_id,
    } = req.body;

    // Проверяем существование заявки
    const existing = await pool.query('SELECT * FROM equipment_requests WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const request = existing.rows[0];

    // Проверка прав: employee может редактировать только свои pending заявки
    if (req.userRole === 'employee') {
      if (request.requester_id !== req.userId) {
        return res.status(403).json({ error: 'Недостаточно прав доступа' });
      }
      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'Нельзя редактировать заявку в этом статусе' });
      }
    }

    // Собираем поля для обновления
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (title !== undefined) {
      paramCount++;
      updates.push(`title = $${paramCount}`);
      values.push(title);
    }
    if (description !== undefined) {
      paramCount++;
      updates.push(`description = $${paramCount}`);
      values.push(description || null);
    }
    if (equipment_category !== undefined) {
      paramCount++;
      updates.push(`equipment_category = $${paramCount}`);
      values.push(equipment_category);
    }
    if (request_type !== undefined) {
      paramCount++;
      updates.push(`request_type = $${paramCount}`);
      values.push(request_type);
    }
    if (quantity !== undefined) {
      paramCount++;
      updates.push(`quantity = $${paramCount}`);
      values.push(quantity);
    }
    if (urgency !== undefined) {
      paramCount++;
      updates.push(`urgency = $${paramCount}`);
      values.push(urgency);
    }
    if (justification !== undefined) {
      paramCount++;
      updates.push(`justification = $${paramCount}`);
      values.push(justification || null);
    }
    if (replace_equipment_id !== undefined) {
      paramCount++;
      updates.push(`replace_equipment_id = $${paramCount}`);
      values.push(replace_equipment_id || null);
    }
    if (estimated_cost !== undefined) {
      paramCount++;
      updates.push(`estimated_cost = $${paramCount}`);
      values.push(estimated_cost ? parseFloat(estimated_cost) : null);
    }

    // Только IT/Admin могут менять эти поля
    if (req.userRole === 'admin' || req.userRole === 'it_specialist') {
      if (status !== undefined) {
        paramCount++;
        updates.push(`status = $${paramCount}`);
        values.push(status);
      }
      if (ordered_at !== undefined) {
        paramCount++;
        updates.push(`ordered_at = $${paramCount}`);
        values.push(ordered_at || null);
      }
      if (received_at !== undefined) {
        paramCount++;
        updates.push(`received_at = $${paramCount}`);
        values.push(received_at || null);
      }
      if (issued_at !== undefined) {
        paramCount++;
        updates.push(`issued_at = $${paramCount}`);
        values.push(issued_at || null);
      }
      if (issued_equipment_id !== undefined) {
        paramCount++;
        updates.push(`issued_equipment_id = $${paramCount}`);
        values.push(issued_equipment_id || null);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    // Обновляем updated_at
    paramCount++;
    updates.push(`updated_at = NOW()`);

    paramCount++;
    values.push(id);

    const result = await pool.query(
      `UPDATE equipment_requests SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка обновления заявки:', error);
    res.status(500).json({ error: 'Ошибка при обновлении заявки' });
  }
});

// Одобрить/отклонить заявку
router.post('/:id/review', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, comment, estimated_cost } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Некорректный статус. Допустимые: approved, rejected' });
    }

    // Проверяем существование и текущий статус
    const existing = await pool.query('SELECT * FROM equipment_requests WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    if (existing.rows[0].status !== 'pending') {
      return res.status(400).json({ error: 'Можно рассматривать только заявки в статусе pending' });
    }

    const result = await pool.query(
      `UPDATE equipment_requests
       SET status = $1,
           reviewer_id = $2,
           review_comment = $3,
           reviewed_at = NOW(),
           estimated_cost = COALESCE($4, estimated_cost),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [status, req.userId, comment || null, estimated_cost ? parseFloat(estimated_cost) : null, id]
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка рассмотрения заявки:', error);
    res.status(500).json({ error: 'Ошибка при рассмотрении заявки' });
  }
});

// Отменить заявку (только автор, только pending)
router.post('/:id/cancel', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await pool.query('SELECT * FROM equipment_requests WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const request = existing.rows[0];

    // Проверяем права
    if (request.requester_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Можно отменить только свою заявку' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Можно отменить только заявку в статусе pending' });
    }

    const result = await pool.query(
      `UPDATE equipment_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка отмены заявки:', error);
    res.status(500).json({ error: 'Ошибка при отмене заявки' });
  }
});

// Удалить заявку (только admin)
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM equipment_requests WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    res.json({ message: 'Заявка удалена' });
  } catch (error) {
    console.error('Ошибка удаления заявки:', error);
    res.status(500).json({ error: 'Ошибка при удалении заявки' });
  }
});

export default router;
