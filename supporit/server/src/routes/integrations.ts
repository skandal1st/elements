import { Router, Response } from 'express';
import { pool } from '../config/database.js';
import { authenticateIntegration, IntegrationRequest } from '../middleware/integration-auth.js';

const router = Router();

// ============================================================================
// Health Check - проверка соединения с HR_desk
// ============================================================================

/**
 * GET /api/integrations/hr-desk/health
 * Проверка работоспособности API для HR_desk
 */
router.get('/hr-desk/health', authenticateIntegration, async (req: IntegrationRequest, res: Response) => {
  try {
    // Проверяем подключение к БД
    await pool.query('SELECT 1');
    
    // Получаем статистику
    const [usersCount, equipmentCount, ticketsCount] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM equipment'),
      pool.query('SELECT COUNT(*) as count FROM tickets'),
    ]);

    res.json({
      status: 'ok',
      integration_source: req.integrationSource,
      database: 'connected',
      stats: {
        users: parseInt(usersCount.rows[0].count),
        equipment: parseInt(equipmentCount.rows[0].count),
        tickets: parseInt(ticketsCount.rows[0].count),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Integration] Ошибка health check:', error);
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// Users API - синхронизация пользователей
// ============================================================================

/**
 * GET /api/integrations/hr-desk/users
 * Получить список всех пользователей для HR_desk
 * Формат ответа: { data: [...] }
 */
router.get('/hr-desk/users', authenticateIntegration, async (req: IntegrationRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT 
        id,
        email,
        full_name,
        full_name as "fullName",
        role,
        department,
        position,
        phone,
        avatar_url,
        created_at,
        updated_at
      FROM users 
      ORDER BY full_name ASC`
    );

    console.log(`[Integration] HR_desk запросил список пользователей: ${result.rows.length} записей`);

    res.json({ data: result.rows });
  } catch (error) {
    console.error('[Integration] Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка при получении пользователей' });
  }
});

/**
 * GET /api/integrations/hr-desk/users/:id
 * Получить пользователя по ID
 */
router.get('/hr-desk/users/:id', authenticateIntegration, async (req: IntegrationRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        id,
        email,
        full_name,
        full_name as "fullName",
        role,
        department,
        position,
        phone,
        avatar_url,
        created_at,
        updated_at
      FROM users 
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('[Integration] Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка при получении пользователя' });
  }
});

/**
 * PUT /api/integrations/hr-desk/users/:id
 * Обновить данные пользователя из HR_desk
 * Принимает: { full_name, department, position, phone }
 */
router.put('/hr-desk/users/:id', authenticateIntegration, async (req: IntegrationRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { full_name, department, position, phone } = req.body;

    // Проверяем существование пользователя
    const existingResult = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Формируем запрос на обновление
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    if (full_name !== undefined) {
      paramCount++;
      fields.push(`full_name = $${paramCount}`);
      values.push(full_name);
    }

    if (department !== undefined) {
      paramCount++;
      fields.push(`department = $${paramCount}`);
      values.push(department || null);
    }

    if (position !== undefined) {
      paramCount++;
      fields.push(`position = $${paramCount}`);
      values.push(position || null);
    }

    if (phone !== undefined) {
      paramCount++;
      fields.push(`phone = $${paramCount}`);
      values.push(phone || null);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    fields.push('updated_at = NOW()');
    paramCount++;
    values.push(id);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING 
      id, email, full_name, full_name as "fullName", role, department, position, phone, avatar_url, created_at, updated_at`;

    const result = await pool.query(query, values);

    console.log(`[Integration] HR_desk обновил пользователя ${id}`);

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('[Integration] Ошибка обновления пользователя:', error);
    res.status(500).json({ error: 'Ошибка при обновлении пользователя' });
  }
});

/**
 * POST /api/integrations/hr-desk/users
 * Создать нового пользователя из HR_desk (синхронизация)
 * Принимает: { email, full_name, department, position, phone }
 */
router.post('/hr-desk/users', authenticateIntegration, async (req: IntegrationRequest, res: Response) => {
  try {
    const { email, full_name, department, position, phone } = req.body;

    if (!email || !full_name) {
      return res.status(400).json({ error: 'Email и full_name обязательны' });
    }

    // Проверяем, существует ли пользователь
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      // Пользователь уже существует - обновляем данные
      const result = await pool.query(
        `UPDATE users SET 
          full_name = $1,
          department = $2,
          position = $3,
          phone = $4,
          updated_at = NOW()
        WHERE email = $5
        RETURNING id, email, full_name, full_name as "fullName", role, department, position, phone, avatar_url, created_at, updated_at`,
        [full_name, department || null, position || null, phone || null, email]
      );

      console.log(`[Integration] HR_desk обновил существующего пользователя: ${email}`);
      return res.json({ data: result.rows[0], updated: true });
    }

    // Создаем нового пользователя (без пароля - будет авторизация через AD/SSO)
    const result = await pool.query(
      `INSERT INTO users (id, email, full_name, role, department, position, phone, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 'employee', $3, $4, $5, NOW(), NOW())
       RETURNING id, email, full_name, full_name as "fullName", role, department, position, phone, avatar_url, created_at, updated_at`,
      [email, full_name, department || null, position || null, phone || null]
    );

    console.log(`[Integration] HR_desk создал нового пользователя: ${email}`);

    res.status(201).json({ data: result.rows[0], created: true });
  } catch (error: any) {
    console.error('[Integration] Ошибка создания пользователя:', error);

    if (error.code === '23505') {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    res.status(500).json({ error: 'Ошибка при создании пользователя' });
  }
});

// ============================================================================
// Equipment API - получение оборудования
// ============================================================================

/**
 * GET /api/integrations/hr-desk/equipment
 * Получить оборудование (с фильтром по owner_id)
 * Формат ответа: { data: [...] }
 */
router.get('/hr-desk/equipment', authenticateIntegration, async (req: IntegrationRequest, res: Response) => {
  try {
    const { owner_id, email } = req.query;

    let query = `
      SELECT 
        e.*,
        u.email as owner_email,
        u.full_name as owner_name
      FROM equipment e
      LEFT JOIN users u ON e.current_owner_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    // Фильтр по ID владельца
    if (owner_id) {
      paramCount++;
      query += ` AND e.current_owner_id = $${paramCount}`;
      params.push(owner_id);
    }

    // Фильтр по email владельца (для поиска оборудования сотрудника)
    if (email && !owner_id) {
      paramCount++;
      query += ` AND u.email = $${paramCount}`;
      params.push(email);
    }

    query += ' ORDER BY e.name ASC';

    const result = await pool.query(query, params);

    console.log(`[Integration] HR_desk запросил оборудование: ${result.rows.length} записей`);

    res.json({ data: result.rows });
  } catch (error) {
    console.error('[Integration] Ошибка получения оборудования:', error);
    res.status(500).json({ error: 'Ошибка при получении оборудования' });
  }
});

/**
 * GET /api/integrations/hr-desk/equipment/:id
 * Получить оборудование по ID
 */
router.get('/hr-desk/equipment/:id', authenticateIntegration, async (req: IntegrationRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        e.*,
        u.email as owner_email,
        u.full_name as owner_name
      FROM equipment e
      LEFT JOIN users u ON e.current_owner_id = u.id
      WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Оборудование не найдено' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('[Integration] Ошибка получения оборудования:', error);
    res.status(500).json({ error: 'Ошибка при получении оборудования' });
  }
});

// ============================================================================
// Tickets API - создание заявок из HR_desk
// ============================================================================

/**
 * POST /api/integrations/hr-desk/tickets
 * Создать заявку из HR_desk (например, при приёме/увольнении сотрудника)
 */
router.post('/hr-desk/tickets', authenticateIntegration, async (req: IntegrationRequest, res: Response) => {
  try {
    const {
      title,
      description,
      category = 'hr',  // По умолчанию категория HR для заявок из HR_desk
      priority = 'medium',
      creator_email,
      equipment_id,
      location_department,
      location_room,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Заголовок и описание обязательны' });
    }

    // Ищем пользователя по email (если указан)
    let creatorId = null;
    if (creator_email) {
      const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [creator_email]);
      if (userResult.rows.length > 0) {
        creatorId = userResult.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO tickets (
        title, description, category, priority, creator_id, equipment_id,
        location_department, location_room, created_via, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'hr_desk', NOW(), NOW())
      RETURNING *`,
      [
        title,
        description,
        category,
        priority,
        creatorId,
        equipment_id || null,
        location_department || null,
        location_room || null,
      ]
    );

    console.log(`[Integration] HR_desk создал заявку: ${result.rows[0].id}`);

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('[Integration] Ошибка создания заявки:', error);
    res.status(500).json({ error: 'Ошибка при создании заявки' });
  }
});

/**
 * GET /api/integrations/hr-desk/tickets
 * Получить заявки (с фильтром)
 */
router.get('/hr-desk/tickets', authenticateIntegration, async (req: IntegrationRequest, res: Response) => {
  try {
    const { status, category, creator_email, limit = '50' } = req.query;

    let query = `
      SELECT 
        t.*,
        c.email as creator_email,
        c.full_name as creator_name,
        a.email as assignee_email,
        a.full_name as assignee_name
      FROM tickets t
      LEFT JOIN users c ON t.creator_id = c.id
      LEFT JOIN users a ON t.assignee_id = a.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND t.status = $${paramCount}`;
      params.push(status);
    }

    if (category) {
      paramCount++;
      query += ` AND t.category = $${paramCount}`;
      params.push(category);
    }

    if (creator_email) {
      paramCount++;
      query += ` AND c.email = $${paramCount}`;
      params.push(creator_email);
    }

    query += ' ORDER BY t.created_at DESC';

    paramCount++;
    query += ` LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));

    const result = await pool.query(query, params);

    console.log(`[Integration] HR_desk запросил заявки: ${result.rows.length} записей`);

    res.json({ data: result.rows });
  } catch (error) {
    console.error('[Integration] Ошибка получения заявок:', error);
    res.status(500).json({ error: 'Ошибка при получении заявок' });
  }
});

// ============================================================================
// Sync API - синхронизация данных
// ============================================================================

/**
 * POST /api/integrations/hr-desk/sync/users
 * Массовая синхронизация пользователей из HR_desk
 * Принимает массив пользователей: { users: [...] }
 */
router.post('/hr-desk/sync/users', authenticateIntegration, async (req: IntegrationRequest, res: Response) => {
  try {
    const { users } = req.body;

    if (!users || !Array.isArray(users)) {
      return res.status(400).json({ error: 'Необходим массив users' });
    }

    let created = 0;
    let updated = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const { email, full_name, department, position, phone, external_id } = user;

        if (!email) {
          errors++;
          continue;
        }

        // Проверяем существование пользователя
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

        if (existingUser.rows.length > 0) {
          // Обновляем существующего пользователя
          await pool.query(
            `UPDATE users SET 
              full_name = COALESCE($1, full_name),
              department = COALESCE($2, department),
              position = COALESCE($3, position),
              phone = COALESCE($4, phone),
              updated_at = NOW()
            WHERE email = $5`,
            [full_name, department, position, phone, email]
          );
          updated++;
        } else {
          // Создаем нового пользователя
          await pool.query(
            `INSERT INTO users (id, email, full_name, role, department, position, phone, created_at, updated_at)
             VALUES (gen_random_uuid(), $1, $2, 'employee', $3, $4, $5, NOW(), NOW())`,
            [email, full_name || email, department || null, position || null, phone || null]
          );
          created++;
        }
      } catch (userError) {
        console.error('[Integration] Ошибка синхронизации пользователя:', userError);
        errors++;
      }
    }

    console.log(`[Integration] HR_desk синхронизировал пользователей: создано ${created}, обновлено ${updated}, ошибок ${errors}`);

    res.json({
      success: true,
      created,
      updated,
      errors,
      total: users.length,
    });
  } catch (error) {
    console.error('[Integration] Ошибка массовой синхронизации:', error);
    res.status(500).json({ error: 'Ошибка при синхронизации пользователей' });
  }
});

export default router;
