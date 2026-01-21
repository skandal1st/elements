import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Создать пользователя (только для admin и it_specialist)
router.post('/', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, full_name, role, department, position, phone } = req.body;

    // Валидация обязательных полей
    if (!email || !full_name) {
      return res.status(400).json({ error: 'Email и полное имя обязательны' });
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Некорректный формат email' });
    }

    // Валидация пароля (если указан)
    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен содержать минимум 6 символов' });
    }

    // Валидация роли
    const validRoles = ['admin', 'it_specialist', 'employee'];
    const userRole = role || 'employee';
    if (!validRoles.includes(userRole)) {
      return res.status(400).json({ error: 'Некорректная роль пользователя' });
    }

    // Проверяем, существует ли пользователь с таким email
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // Хешируем пароль, если он указан
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

    // Создаем пользователя
    const result = await pool.query(
      `INSERT INTO users (id, email, full_name, password_hash, role, department, position, phone, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING id, email, full_name, role, department, position, phone, avatar_url, created_at, updated_at`,
      [
        email,
        full_name,
        hashedPassword,
        userRole,
        department || null,
        position || null,
        phone || null,
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Ошибка создания пользователя:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });

    if (error.code === '23505') {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    if (error.code === '23514') {
      return res.status(400).json({ error: 'Некорректное значение для роли' });
    }

    res.status(500).json({
      error: 'Ошибка при создании пользователя',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Получить список пользователей
router.get('/', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT id, email, full_name, role, department, position, phone, avatar_url, created_at, updated_at FROM users ORDER BY full_name ASC'
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка при получении пользователей' });
  }
});

// Получить пользователя по ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Пользователь может видеть только свой профиль, админ - любой
    if (req.userId !== id && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Недостаточно прав доступа' });
    }

    const result = await pool.query(
      'SELECT id, email, full_name, role, department, position, phone, avatar_url, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Ошибка получения пользователя:', error);
    res.status(500).json({ error: 'Ошибка при получении пользователя' });
  }
});

// Обновить пользователя (только admin и it_specialist могут обновлять)
router.put('/:id', authenticate, requireRole('admin', 'it_specialist'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Проверяем существование пользователя
    const existingResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const existingUser = existingResult.rows[0];

    // Проверяем, что не меняем роль последнего админа
    if (updates.role && updates.role !== existingUser.role && existingUser.role === 'admin') {
      const adminCount = await pool.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      );
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({ 
          error: 'Невозможно изменить роль последнего администратора' 
        });
      }
    }

    // Валидация роли
    if (updates.role && !['admin', 'it_specialist', 'employee'].includes(updates.role)) {
      return res.status(400).json({ error: 'Некорректная роль пользователя' });
    }

    // Формируем динамический запрос
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 0;

    const allowedFields = ['full_name', 'role', 'department', 'position', 'phone'];

    Object.keys(updates).forEach((key) => {
      if (allowedFields.includes(key) && updates[key] !== undefined) {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key] === '' ? null : updates[key]);
      }
    });

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Нет полей для обновления' });
    }

    fields.push(`updated_at = NOW()`);
    paramCount++;
    values.push(id);

    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING id, email, full_name, role, department, position, phone, avatar_url, created_at, updated_at`;

    const result = await pool.query(query, values);

    res.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Ошибка обновления пользователя:', error);
    console.error('Детали ошибки:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
    });
    
    if (error.code === '23514') {
      return res.status(400).json({ error: 'Некорректное значение для роли' });
    }
    
    res.status(500).json({ 
      error: 'Ошибка при обновлении пользователя',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Удалить пользователя (только admin)
router.delete('/:id', authenticate, requireRole('admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Нельзя удалить самого себя
    if (id === req.userId) {
      return res.status(400).json({ error: 'Нельзя удалить самого себя' });
    }

    // Проверяем существование пользователя
    const existingResult = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const existingUser = existingResult.rows[0];

    // Проверяем, что не удаляем последнего администратора
    if (existingUser.role === 'admin') {
      const adminCount = await pool.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      );
      if (parseInt(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({ 
          error: 'Невозможно удалить последнего администратора' 
        });
      }
    }

    // Удаляем пользователя
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id, email, full_name, role', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    res.json({ message: 'Пользователь успешно удален', data: result.rows[0] });
  } catch (error: any) {
    console.error('Ошибка удаления пользователя:', error);
    
    // Проверка на внешние ключи
    if (error.code === '23503') {
      return res.status(400).json({ 
        error: 'Невозможно удалить пользователя: он используется в системе' 
      });
    }
    
    res.status(500).json({ 
      error: 'Ошибка при удалении пользователя',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;



