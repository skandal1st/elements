import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../config/database.js";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

// Валидация JWT_SECRET при загрузке модуля
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error(
    "[Auth] КРИТИЧЕСКАЯ ОШИБКА: JWT_SECRET не установлен в переменных окружения",
  );
  console.error("[Auth] Сгенерируйте секрет командой: openssl rand -hex 32");
  process.exit(1);
}

if (jwtSecret.length < 32) {
  console.error(
    "[Auth] КРИТИЧЕСКАЯ ОШИБКА: JWT_SECRET слишком короткий (минимум 32 символа)",
  );
  console.error("[Auth] Сгенерируйте секрет командой: openssl rand -hex 32");
  process.exit(1);
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "[Auth] ❌ Токен не предоставлен для",
          req.method,
          req.path,
        );
      }
      return res.status(401).json({ error: "Токен не предоставлен" });
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId: string;
      email: string;
      role: string;
    };

    req.userId = decoded.userId;
    req.userRole = decoded.role;

    if (process.env.NODE_ENV === "development") {
      console.log("[Auth] ✅ Токен валиден для пользователя:", decoded.userId);
    }
    next();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.log("[Auth] ❌ Недействительный токен для", req.method, req.path);
      console.log(
        "[Auth] Ошибка:",
        error instanceof Error ? error.message : error,
      );
    }
    return res.status(401).json({ error: "Недействительный токен" });
  }
};

export const requireRole = (...roles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userRole) {
      return res.status(401).json({ error: "Пользователь не авторизован" });
    }

    // Проверяем роль из токена (приводим к нижнему регистру для сравнения)
    const tokenRole = req.userRole?.toLowerCase();
    const requiredRolesLower = roles.map((r) => r.toLowerCase());

    if (!requiredRolesLower.includes(tokenRole)) {
      // Дополнительная проверка: получаем актуальную роль из БД
      // Это нужно на случай, если роль была изменена после создания токена
      try {
        const result = await pool.query(
          "SELECT role FROM users WHERE id = $1",
          [req.userId],
        );

        if (result.rows.length > 0) {
          const actualRole = result.rows[0].role?.toLowerCase(); // Приводим к нижнему регистру
          const tokenRole = req.userRole?.toLowerCase();

          // Проверяем с актуальной ролью из БД (приводим к нижнему регистру)
          if (!roles.map((r) => r.toLowerCase()).includes(actualRole)) {
            console.log(
              `Access denied: User ${req.userId} has role '${actualRole}' (token had '${tokenRole}'), required: ${roles.join(", ")}`,
            );
            return res.status(403).json({
              error: "Недостаточно прав доступа",
              debug: {
                tokenRole: tokenRole,
                actualRole: actualRole,
                requiredRoles: roles,
              },
            });
          }

          // Если актуальная роль подходит, обновляем роль в запросе и продолжаем
          req.userRole = actualRole;
        } else {
          console.log(`User ${req.userId} not found in database`);
          return res.status(403).json({ error: "Недостаточно прав доступа" });
        }
      } catch (error) {
        console.error("Ошибка проверки роли из БД:", error);
        return res.status(403).json({ error: "Недостаточно прав доступа" });
      }
    }

    next();
  };
};
