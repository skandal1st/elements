import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";
import { authenticate, AuthRequest } from "../middleware/auth.js";
import { z } from "zod";

// JWT expiration time in seconds (default 7 days)
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN
  ? parseInt(process.env.JWT_EXPIRES_IN, 10) || 604800
  : 604800;

console.log("[Auth] JWT_EXPIRES_IN from env:", process.env.JWT_EXPIRES_IN);
console.log(
  "[Auth] Parsed JWT_EXPIRES_IN:",
  JWT_EXPIRES_IN,
  "seconds (",
  JWT_EXPIRES_IN / 86400,
  "days)",
);

const router = Router();

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(1),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Регистрация
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email, password, fullName } = signUpSchema.parse(req.body);

    // Проверяем, существует ли пользователь
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email],
    );

    if (existingUser.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "Пользователь с таким email уже существует" });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаем пользователя
    const result = await pool.query(
      `INSERT INTO users (id, email, full_name, password_hash, role, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'employee', NOW(), NOW())
       RETURNING id, email, full_name, role, department, position, phone, avatar_url, created_at, updated_at`,
      [email, fullName, hashedPassword],
    );

    const user = result.rows[0];

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "",
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.status(201).json({
      user: {
        ...user,
        password_hash: undefined,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Неверные данные", details: error.errors });
    }
    console.error("Ошибка регистрации:", error);
    res.status(500).json({ error: "Ошибка при регистрации" });
  }
});

// Вход
router.post("/signin", async (req: Request, res: Response) => {
  try {
    const { email, password } = signInSchema.parse(req.body);

    // Находим пользователя
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }

    const user = result.rows[0];

    // Если у пользователя нет пароля, ему нужно установить его при первом входе
    if (!user.password_hash) {
      return res.status(401).json({
        error: "Пароль не установлен",
        requiresPassword: true,
        email: user.email,
      });
    }

    // Проверяем пароль
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: "Неверный email или пароль" });
    }

    // Генерируем JWT токен
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "",
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
        position: user.position,
        phone: user.phone,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Неверные данные", details: error.errors });
    }
    console.error("Ошибка входа:", error);
    res.status(500).json({ error: "Ошибка при входе" });
  }
});

// Установить пароль при первом входе
router.post("/set-password", async (req: Request, res: Response) => {
  try {
    const { email, password } = z
      .object({
        email: z.string().email(),
        password: z
          .string()
          .min(6, "Пароль должен содержать минимум 6 символов"),
      })
      .parse(req.body);

    // Находим пользователя
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    const user = result.rows[0];

    // Проверяем, что пароль еще не установлен
    if (user.password_hash) {
      return res.status(400).json({ error: "Пароль уже установлен" });
    }

    // Хешируем и сохраняем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [hashedPassword, user.id],
    );

    // Генерируем JWT токен для автоматического входа
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || "",
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
        position: user.position,
        phone: user.phone,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Неверные данные", details: error.errors });
    }
    console.error("Ошибка установки пароля:", error);
    res.status(500).json({ error: "Ошибка при установке пароля" });
  }
});

// Получить текущего пользователя
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT id, email, full_name, role, department, position, phone, avatar_url, created_at, updated_at FROM users WHERE id = $1",
      [req.userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("Ошибка получения пользователя:", error);
    res.status(500).json({ error: "Ошибка при получении пользователя" });
  }
});

// Выход (на клиенте просто удаляется токен)
router.post("/signout", authenticate, (req: Request, res: Response) => {
  res.json({ message: "Выход выполнен успешно" });
});

// Смена пароля (для авторизованного пользователя)
router.post(
  "/update-password",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { currentPassword, newPassword } = z
        .object({
          currentPassword: z.string().min(1, "Текущий пароль обязателен"),
          newPassword: z
            .string()
            .min(6, "Новый пароль должен содержать минимум 6 символов"),
        })
        .parse(req.body);

      // Получаем пользователя
      const result = await pool.query(
        "SELECT id, password_hash FROM users WHERE id = $1",
        [req.userId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      const user = result.rows[0];

      // Проверяем текущий пароль
      if (!user.password_hash) {
        return res
          .status(400)
          .json({
            error:
              "Пароль не установлен. Используйте функцию установки пароля.",
          });
      }

      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password_hash,
      );
      if (!isValidPassword) {
        return res.status(401).json({ error: "Неверный текущий пароль" });
      }

      // Хешируем и сохраняем новый пароль
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await pool.query(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        [hashedPassword, req.userId],
      );

      res.json({ message: "Пароль успешно изменён" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Неверные данные", details: error.errors });
      }
      console.error("Ошибка смены пароля:", error);
      res.status(500).json({ error: "Ошибка при смене пароля" });
    }
  },
);

// Сброс пароля администратором (для любого пользователя)
router.post(
  "/reset-password",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      // Проверяем, что запрос от администратора
      if (req.userRole !== "admin") {
        return res
          .status(403)
          .json({ error: "Только администратор может сбрасывать пароли" });
      }

      const { userId, newPassword } = z
        .object({
          userId: z.string().uuid("Некорректный ID пользователя"),
          newPassword: z
            .string()
            .min(6, "Пароль должен содержать минимум 6 символов"),
        })
        .parse(req.body);

      // Проверяем существование пользователя
      const result = await pool.query(
        "SELECT id, email FROM users WHERE id = $1",
        [userId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      // Хешируем и сохраняем новый пароль
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await pool.query(
        "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        [hashedPassword, userId],
      );

      res.json({ message: "Пароль пользователя успешно сброшен" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Неверные данные", details: error.errors });
      }
      console.error("Ошибка сброса пароля:", error);
      res.status(500).json({ error: "Ошибка при сбросе пароля" });
    }
  },
);

export default router;
