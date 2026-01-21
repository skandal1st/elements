import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.js";
import {
  isADEnabled,
  getADUsers,
  getADUserByUsername,
  getADGroups,
  testADConnection,
  type ADUser,
} from "../services/ad.service.js";
import { pool } from "../config/database.js";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// Middleware для проверки включения AD
const checkADEnabled = (req: AuthRequest, res: Response, next: Function) => {
  if (!isADEnabled()) {
    return res.status(400).json({
      error: "Интеграция с Active Directory отключена",
    });
  }
  next();
};

// Проверка подключения к AD
router.get(
  "/test",
  authenticate,
  requireRole("admin"),
  checkADEnabled,
  async (_req: AuthRequest, res: Response) => {
    try {
      const result = await testADConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Получить статус AD интеграции
router.get(
  "/status",
  authenticate,
  requireRole("admin"),
  async (_req: AuthRequest, res: Response) => {
    res.json({
      enabled: isADEnabled(),
    });
  }
);

// Получить список пользователей из AD
router.get(
  "/users",
  authenticate,
  requireRole("admin"),
  checkADEnabled,
  async (req: AuthRequest, res: Response) => {
    try {
      const { search } = req.query;
      const users = await getADUsers(search as string | undefined);

      // Получаем список уже импортированных пользователей
      const existingResult = await pool.query(
        "SELECT email, ad_username FROM users WHERE ad_username IS NOT NULL"
      );
      const existingUsers = new Map(
        existingResult.rows.map((row: any) => [row.ad_username?.toLowerCase(), row.email])
      );

      // Помечаем пользователей, которые уже импортированы
      const usersWithStatus = users.map((user) => ({
        ...user,
        imported: existingUsers.has(user.sAMAccountName.toLowerCase()),
        localEmail: existingUsers.get(user.sAMAccountName.toLowerCase()) || null,
      }));

      res.json({
        data: usersWithStatus,
        count: usersWithStatus.length,
      });
    } catch (error: any) {
      console.error("[AD] Ошибка получения пользователей:", error);
      res.status(500).json({
        error: `Ошибка получения пользователей из AD: ${error.message}`,
      });
    }
  }
);

// Получить пользователя AD по username
router.get(
  "/users/:username",
  authenticate,
  requireRole("admin"),
  checkADEnabled,
  async (req: AuthRequest, res: Response) => {
    try {
      const { username } = req.params;
      const user = await getADUserByUsername(username);

      if (!user) {
        return res.status(404).json({
          error: "Пользователь не найден в AD",
        });
      }

      // Проверяем, импортирован ли пользователь
      const existingResult = await pool.query(
        "SELECT id, email FROM users WHERE ad_username = $1",
        [user.sAMAccountName]
      );

      res.json({
        data: {
          ...user,
          imported: existingResult.rows.length > 0,
          localUserId: existingResult.rows[0]?.id || null,
          localEmail: existingResult.rows[0]?.email || null,
        },
      });
    } catch (error: any) {
      console.error("[AD] Ошибка получения пользователя:", error);
      res.status(500).json({
        error: `Ошибка получения пользователя из AD: ${error.message}`,
      });
    }
  }
);

// Получить список групп из AD
router.get(
  "/groups",
  authenticate,
  requireRole("admin"),
  checkADEnabled,
  async (req: AuthRequest, res: Response) => {
    try {
      const { search } = req.query;
      const groups = await getADGroups(search as string | undefined);

      res.json({
        data: groups,
        count: groups.length,
      });
    } catch (error: any) {
      console.error("[AD] Ошибка получения групп:", error);
      res.status(500).json({
        error: `Ошибка получения групп из AD: ${error.message}`,
      });
    }
  }
);

// Импортировать пользователя из AD
router.post(
  "/import",
  authenticate,
  requireRole("admin"),
  checkADEnabled,
  async (req: AuthRequest, res: Response) => {
    try {
      const { username, role = "employee" } = req.body;

      if (!username) {
        return res.status(400).json({
          error: "Не указан username пользователя",
        });
      }

      // Получаем пользователя из AD
      const adUser = await getADUserByUsername(username);
      if (!adUser) {
        return res.status(404).json({
          error: "Пользователь не найден в AD",
        });
      }

      // Проверяем, не импортирован ли уже
      const existingResult = await pool.query(
        "SELECT id FROM users WHERE ad_username = $1 OR email = $2",
        [adUser.sAMAccountName, adUser.mail || adUser.userPrincipalName]
      );

      if (existingResult.rows.length > 0) {
        return res.status(409).json({
          error: "Пользователь уже существует в системе",
        });
      }

      // Создаем пользователя в локальной БД
      const email = adUser.mail || adUser.userPrincipalName;
      if (!email) {
        return res.status(400).json({
          error: "У пользователя AD отсутствует email",
        });
      }

      // Генерируем случайный пароль (пользователь будет входить через AD)
      const randomPassword = uuidv4();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      const result = await pool.query(
        `INSERT INTO users (
          email, password_hash, full_name, role, department,
          phone, position, ad_username, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, email, full_name, role, department, phone, position, ad_username`,
        [
          email,
          hashedPassword,
          adUser.displayName,
          role,
          adUser.department,
          adUser.telephoneNumber || adUser.mobile,
          adUser.title,
          adUser.sAMAccountName,
        ]
      );

      console.log(
        `[AD] Пользователь ${adUser.sAMAccountName} импортирован как ${email}`
      );

      res.status(201).json({
        message: "Пользователь успешно импортирован",
        data: result.rows[0],
      });
    } catch (error: any) {
      console.error("[AD] Ошибка импорта пользователя:", error);
      res.status(500).json({
        error: `Ошибка импорта пользователя: ${error.message}`,
      });
    }
  }
);

// Массовый импорт пользователей из AD
router.post(
  "/import-bulk",
  authenticate,
  requireRole("admin"),
  checkADEnabled,
  async (req: AuthRequest, res: Response) => {
    try {
      const { usernames, role = "employee" } = req.body;

      if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
        return res.status(400).json({
          error: "Не указан список пользователей для импорта",
        });
      }

      const results: {
        success: string[];
        failed: { username: string; error: string }[];
      } = {
        success: [],
        failed: [],
      };

      for (const username of usernames) {
        try {
          // Получаем пользователя из AD
          const adUser = await getADUserByUsername(username);
          if (!adUser) {
            results.failed.push({ username, error: "Не найден в AD" });
            continue;
          }

          // Проверяем, не импортирован ли уже
          const existingResult = await pool.query(
            "SELECT id FROM users WHERE ad_username = $1 OR email = $2",
            [adUser.sAMAccountName, adUser.mail || adUser.userPrincipalName]
          );

          if (existingResult.rows.length > 0) {
            results.failed.push({ username, error: "Уже существует в системе" });
            continue;
          }

          const email = adUser.mail || adUser.userPrincipalName;
          if (!email) {
            results.failed.push({ username, error: "Отсутствует email" });
            continue;
          }

          // Генерируем случайный пароль
          const randomPassword = uuidv4();
          const hashedPassword = await bcrypt.hash(randomPassword, 10);

          await pool.query(
            `INSERT INTO users (
              email, password_hash, full_name, role, department,
              phone, position, ad_username, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
            [
              email,
              hashedPassword,
              adUser.displayName,
              role,
              adUser.department,
              adUser.telephoneNumber || adUser.mobile,
              adUser.title,
              adUser.sAMAccountName,
            ]
          );

          results.success.push(username);
        } catch (err: any) {
          results.failed.push({ username, error: err.message });
        }
      }

      console.log(
        `[AD] Массовый импорт: успешно ${results.success.length}, ошибок ${results.failed.length}`
      );

      res.json({
        message: `Импортировано ${results.success.length} из ${usernames.length} пользователей`,
        data: results,
      });
    } catch (error: any) {
      console.error("[AD] Ошибка массового импорта:", error);
      res.status(500).json({
        error: `Ошибка массового импорта: ${error.message}`,
      });
    }
  }
);

// Синхронизация данных пользователя с AD
router.post(
  "/sync/:userId",
  authenticate,
  requireRole("admin"),
  checkADEnabled,
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;

      // Получаем локального пользователя
      const userResult = await pool.query(
        "SELECT * FROM users WHERE id = $1",
        [userId]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: "Пользователь не найден",
        });
      }

      const localUser = userResult.rows[0];
      if (!localUser.ad_username) {
        return res.status(400).json({
          error: "Пользователь не связан с AD",
        });
      }

      // Получаем актуальные данные из AD
      const adUser = await getADUserByUsername(localUser.ad_username);
      if (!adUser) {
        return res.status(404).json({
          error: "Пользователь не найден в AD",
        });
      }

      // Обновляем локальные данные
      const updateResult = await pool.query(
        `UPDATE users SET
          full_name = $1,
          department = $2,
          phone = $3,
          position = $4,
          updated_at = NOW()
        WHERE id = $5
        RETURNING id, email, full_name, role, department, phone, position, ad_username`,
        [
          adUser.displayName,
          adUser.department,
          adUser.telephoneNumber || adUser.mobile,
          adUser.title,
          userId,
        ]
      );

      console.log(`[AD] Данные пользователя ${localUser.ad_username} синхронизированы`);

      res.json({
        message: "Данные пользователя синхронизированы",
        data: updateResult.rows[0],
      });
    } catch (error: any) {
      console.error("[AD] Ошибка синхронизации:", error);
      res.status(500).json({
        error: `Ошибка синхронизации: ${error.message}`,
      });
    }
  }
);

export default router;
