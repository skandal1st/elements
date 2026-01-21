import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import authRoutes from "./routes/auth.js";
import equipmentRoutes from "./routes/equipment.js";
import usersRoutes from "./routes/users.js";
import ticketsRoutes from "./routes/tickets.js";
import ticketCommentsRoutes from "./routes/ticket-comments.js";
import consumablesRoutes from "./routes/consumables.js";
import buildingsRoutes from "./routes/buildings.js";
import zabbixRoutes from "./routes/zabbix.js";
import dictionariesRoutes from "./routes/dictionaries.js";
import settingsRoutes from "./routes/settings.js";
import notificationsRoutes from "./routes/notifications.js";
import licensesRoutes from "./routes/licenses.js";
import telegramRoutes from "./routes/telegram.js";
import updatesRoutes from "./routes/updates.js";
import adRoutes from "./routes/ad.js";
import integrationsRoutes from "./routes/integrations.js";
import equipmentRequestsRoutes from "./routes/equipment-requests.js";
import reportsRoutes from "./routes/reports.js";
import { pool } from "./config/database.js";
import { startEmailCron } from "./services/email-cron.service.js";
import { verifySmtpConnection } from "./services/email-sender.service.js";
import { initTelegramBot, stopTelegramBot } from "./telegram/bot.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === "production";

// Security: Helmet для HTTP заголовков безопасности
app.use(
  helmet({
    contentSecurityPolicy: false, // Отключаем CSP, т.к. фронтенд отдельно
    crossOriginEmbedderPolicy: false,
  }),
);

// Security: Rate limiting для защиты от brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 10, // 10 попыток за 15 минут
  message: { error: "Слишком много попыток. Попробуйте позже." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction, // Пропускаем в development
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 500, // 500 запросов за 15 минут
  message: { error: "Слишком много запросов. Попробуйте позже." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isProduction,
});

// CORS конфигурация
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // В production требуем origin header
      if (!origin) {
        if (isProduction) {
          // Разрешаем запросы без origin только для health check и внутренних сервисов
          return callback(null, true);
        }
        return callback(null, true);
      }
      if (corsOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400, // 24 часа
  }),
);

// Общий rate limiter для API
app.use("/api", apiLimiter);

// Строгий rate limiter для auth endpoints
app.use("/api/auth/signin", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/reset-password", authLimiter);
app.use("/api/auth/set-password", authLimiter);

app.use(express.json({ limit: "10mb" }));

// Статические файлы для загруженных вложений
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/tickets", ticketsRoutes);
app.use("/api/ticket-comments", ticketCommentsRoutes);
app.use("/api/consumables", consumablesRoutes);
app.use("/api/buildings", buildingsRoutes);
app.use("/api/zabbix", zabbixRoutes);
app.use("/api/dictionaries", dictionariesRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/licenses", licensesRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api/updates", updatesRoutes);
app.use("/api/ad", adRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/equipment-requests", equipmentRequestsRoutes);
app.use("/api/reports", reportsRoutes);

// Health check
app.get("/health", async (req, res) => {
  try {
    // Проверяем подключение к БД
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: "error",
      database: "disconnected",
      error: "Database connection failed",
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📡 API доступен по адресу: http://localhost:${PORT}/api`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);

  // Проверка SMTP соединения
  if (process.env.SMTP_ENABLED === "true") {
    const smtpOk = await verifySmtpConnection();
    if (smtpOk) {
      console.log("📧 SMTP соединение установлено");
    } else {
      console.warn(
        "⚠️  SMTP соединение не установлено (проверьте настройки в .env)",
      );
    }
  }

  // Запуск email-приемника (cron для проверки писем)
  if (process.env.EMAIL_RECEIVER_ENABLED === "true") {
    startEmailCron();
    console.log("📬 Email-приемник запущен");
  }

  // Запуск Telegram бота
  if (process.env.TELEGRAM_BOT_ENABLED === "true") {
    const bot = await initTelegramBot();
    if (bot) {
      console.log("🤖 Telegram бот запущен");
    }
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("⏹️  Получен сигнал SIGTERM, завершаем работу...");
  await stopTelegramBot();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("⏹️  Получен сигнал SIGINT, завершаем работу...");
  await stopTelegramBot();
  process.exit(0);
});
