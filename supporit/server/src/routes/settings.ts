import { Router, Response, Request } from "express";
import { pool } from "../config/database.js";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { z } from "zod";
import nodemailer from "nodemailer";
import multer, { FileFilterCallback } from "multer";
import path from "path";
import fs from "fs";

// Интерфейс для запроса с файлом
interface MulterRequest extends AuthRequest {
  file?: Express.Multer.File;
}

// Настройка multer для загрузки favicon
const faviconStorage = multer.diskStorage({
  destination: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => {
    const uploadDir = path.join(process.cwd(), "uploads", "branding");
    // Создаем директорию если не существует
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    // Сохраняем как favicon с оригинальным расширением
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `favicon${ext}`);
  },
});

const faviconUpload = multer({
  storage: faviconStorage,
  limits: {
    fileSize: 1024 * 1024, // 1MB максимум
  },
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: FileFilterCallback,
  ) => {
    // Разрешаем только изображения
    const allowedMimes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/svg+xml",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Разрешены только файлы изображений (PNG, JPG, GIF, SVG, ICO)",
        ),
      );
    }
  },
});

const router = Router();

// Схема валидации для обновления настройки
const updateSettingSchema = z.object({
  value: z.string(),
});

// GET /api/settings - получить все настройки (только admin)
router.get(
  "/",
  authenticate,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await pool.query(
        "SELECT id, setting_key, setting_value, is_encrypted, setting_type, description FROM system_settings ORDER BY setting_type, setting_key",
      );

      // Для зашифрованных настроек возвращаем замаскированное значение
      const settings = result.rows.map((row) => ({
        ...row,
        setting_value:
          row.is_encrypted && row.setting_value ? "***" : row.setting_value,
      }));

      res.json({ data: settings });
    } catch (error) {
      console.error("[Settings API] Ошибка получения настроек:", error);
      res.status(500).json({ error: "Ошибка при получении настроек" });
    }
  },
);

// GET /api/settings/branding - публичный endpoint для получения branding настроек
// Не требует аутентификации, т.к. используется для отображения title и favicon
router.get("/branding", async (req, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT setting_key, setting_value
       FROM system_settings
       WHERE setting_type = 'branding'`,
    );

    const branding: Record<string, string> = {};
    for (const row of result.rows) {
      branding[row.setting_key] = row.setting_value || "";
    }

    res.json({
      data: {
        site_title: branding.site_title || "SuppOrIT",
        site_favicon: branding.site_favicon || "",
      },
    });
  } catch (error) {
    console.error("[Settings API] Ошибка получения branding настроек:", error);
    // Возвращаем дефолтные значения в случае ошибки
    res.json({
      data: {
        site_title: "SuppOrIT",
        site_favicon: "",
      },
    });
  }
});

// POST /api/settings/upload-favicon - загрузка файла favicon (только admin)
router.post(
  "/upload-favicon",
  authenticate,
  requireRole("admin"),
  faviconUpload.single("favicon"),
  async (req: MulterRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Файл не загружен" });
      }

      // Формируем URL для доступа к файлу
      const faviconUrl = `/uploads/branding/${req.file.filename}`;

      // Обновляем настройку в БД
      await pool.query(
        `UPDATE system_settings
         SET setting_value = $1, updated_at = NOW()
         WHERE setting_key = 'site_favicon'`,
        [faviconUrl],
      );

      res.json({
        message: "Favicon успешно загружен",
        data: {
          url: faviconUrl,
        },
      });
    } catch (error) {
      console.error("[Settings API] Ошибка загрузки favicon:", error);
      res.status(500).json({ error: "Ошибка при загрузке favicon" });
    }
  },
);

// DELETE /api/settings/favicon - удаление favicon (только admin)
router.delete(
  "/favicon",
  authenticate,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      // Получаем текущий путь favicon
      const result = await pool.query(
        `SELECT setting_value FROM system_settings WHERE setting_key = 'site_favicon'`,
      );

      const currentFavicon = result.rows[0]?.setting_value;

      // Удаляем файл если существует
      if (currentFavicon) {
        const filePath = path.join(process.cwd(), currentFavicon);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      // Очищаем настройку в БД
      await pool.query(
        `UPDATE system_settings
         SET setting_value = '', updated_at = NOW()
         WHERE setting_key = 'site_favicon'`,
      );

      res.json({ message: "Favicon удален" });
    } catch (error) {
      console.error("[Settings API] Ошибка удаления favicon:", error);
      res.status(500).json({ error: "Ошибка при удалении favicon" });
    }
  },
);

// GET /api/settings/:key - получить конкретную настройку (только admin)
router.get(
  "/:key",
  authenticate,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { key } = req.params;

      const result = await pool.query(
        "SELECT id, setting_key, setting_value, is_encrypted, setting_type, description FROM system_settings WHERE setting_key = $1",
        [key],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Настройка не найдена" });
      }

      const setting = result.rows[0];

      // Для зашифрованных настроек возвращаем замаскированное значение
      if (setting.is_encrypted && setting.setting_value) {
        setting.setting_value = "***";
      }

      res.json({ data: setting });
    } catch (error) {
      console.error("[Settings API] Ошибка получения настройки:", error);
      res.status(500).json({ error: "Ошибка при получении настройки" });
    }
  },
);

// PUT /api/settings/:key - обновить настройку (только admin)
router.put(
  "/:key",
  authenticate,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { key } = req.params;
      const { value } = updateSettingSchema.parse(req.body);

      // Проверяем существование настройки
      const existing = await pool.query(
        "SELECT * FROM system_settings WHERE setting_key = $1",
        [key],
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: "Настройка не найдена" });
      }

      const setting = existing.rows[0];
      let valueToStore = value;

      // Если настройка зашифрована, шифруем значение
      if (setting.is_encrypted && value && value !== "***") {
        try {
          valueToStore = encrypt(value);
        } catch (error) {
          console.error("[Settings API] Ошибка шифрования:", error);
          return res
            .status(500)
            .json({ error: "Ошибка при шифровании значения" });
        }
      }

      // Обновляем настройку
      const result = await pool.query(
        `UPDATE system_settings
       SET setting_value = $1, updated_at = NOW()
       WHERE setting_key = $2
       RETURNING id, setting_key, setting_value, is_encrypted, setting_type, description`,
        [valueToStore, key],
      );

      const updated = result.rows[0];

      // Для зашифрованных возвращаем замаскированное значение
      if (updated.is_encrypted && updated.setting_value) {
        updated.setting_value = "***";
      }

      res.json({
        message: "Настройка обновлена",
        data: updated,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Неверные данные", details: error.errors });
      }
      console.error("[Settings API] Ошибка обновления настройки:", error);
      res.status(500).json({ error: "Ошибка при обновлении настройки" });
    }
  },
);

// POST /api/settings/test-email - тестовая отправка email (только admin)
router.post(
  "/test-email",
  authenticate,
  requireRole("admin"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { to } = z.object({ to: z.string().email() }).parse(req.body);

      // Получаем SMTP настройки из БД
      const result = await pool.query(
        `SELECT setting_key, setting_value, is_encrypted
       FROM system_settings
       WHERE setting_type IN ('smtp', 'email')`,
      );

      const settings: Record<string, string> = {};
      for (const row of result.rows) {
        let value = row.setting_value;
        if (row.is_encrypted && value) {
          try {
            value = decrypt(value);
          } catch (error) {
            console.error("[Settings API] Ошибка расшифровки:", error);
            return res.status(500).json({
              error: `Ошибка расшифровки настройки ${row.setting_key}`,
            });
          }
        }
        settings[row.setting_key] = value;
      }

      // Проверяем наличие обязательных настроек
      if (
        !settings.smtp_host ||
        !settings.smtp_user ||
        !settings.smtp_password
      ) {
        return res
          .status(400)
          .json({ error: "SMTP настройки не заполнены полностью" });
      }

      // Логируем настройки (без пароля)
      console.log("[Settings API] SMTP настройки:", {
        host: settings.smtp_host,
        port: settings.smtp_port || "587",
        secure: settings.smtp_secure === "true",
        user: settings.smtp_user,
        from_email: settings.from_email,
        from_name: settings.from_name,
      });

      // Создаем transporter
      const transporter = nodemailer.createTransport({
        host: settings.smtp_host,
        port: parseInt(settings.smtp_port || "587"),
        secure: settings.smtp_secure === "true",
        auth: {
          user: settings.smtp_user,
          pass: settings.smtp_password,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
      });

      // Проверяем SMTP соединение
      try {
        await transporter.verify();
        console.log("[Settings API] SMTP соединение успешно проверено");
      } catch (verifyError) {
        console.error(
          "[Settings API] Ошибка проверки SMTP соединения:",
          verifyError,
        );
        return res.status(500).json({
          error: "Не удалось подключиться к SMTP серверу",
          details:
            verifyError instanceof Error
              ? verifyError.message
              : "Неизвестная ошибка",
        });
      }

      // Отправляем тестовое письмо
      await transporter.sendMail({
        from: `"${settings.from_name || "SupporIT"}" <${settings.from_email || settings.smtp_user}>`,
        to: to,
        subject: "Тестовое письмо из SupporIT",
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
        </head>
        <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f3f4f6; border-radius: 8px; padding: 20px;">
            <h2 style="color: #1f2937; margin-top: 0;">Тестовое письмо</h2>
            <p style="color: #4b5563;">Это тестовое письмо из системы SupporIT.</p>
            <p style="color: #4b5563;">Если вы получили это письмо, значит SMTP настройки работают корректно! ✅</p>
            <hr style="border: none; border-top: 1px solid #d1d5db; margin: 20px 0;">
            <p style="color: #6b7280; font-size: 12px;">
              Отправлено из системы <strong>SupporIT</strong><br>
              ${new Date().toLocaleString("ru-RU")}
            </p>
          </div>
        </body>
        </html>
      `,
      });

      res.json({ message: "Тестовое письмо отправлено" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ error: "Неверные данные", details: error.errors });
      }
      console.error("[Settings API] Ошибка отправки тестового письма:", error);
      res.status(500).json({
        error: "Ошибка при отправке тестового письма",
        details: error instanceof Error ? error.message : "Неизвестная ошибка",
      });
    }
  },
);

export default router;
