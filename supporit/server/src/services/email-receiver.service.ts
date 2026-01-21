/**
 * Email Receiver Service
 * Получает письма через IMAP и создает тикеты или комментарии (для ответов)
 */

import Imap from "imap";
import { simpleParser, ParsedMail, Attachment } from "mailparser";
import { pool } from "../config/database.js";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

// Типы
interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

interface ParsedTicketData {
  from: string;
  subject: string;
  body: string;
  category: "hardware" | "software" | "network" | "other";
  priority: "low" | "medium" | "high" | "critical";
  attachments: string[]; // Пути к сохраненным файлам
  messageId?: string; // Message-ID письма
  inReplyTo?: string; // In-Reply-To header
  references?: string[]; // References header
}

interface FoundTicket {
  id: string;
  status: string;
  email_message_id: string | null;
  email_subject: string | null;
}

// Конфигурация IMAP (все значения должны быть в .env)
const emailConfig: EmailConfig = {
  host: process.env.IMAP_HOST || "",
  port: parseInt(process.env.IMAP_PORT || "993"),
  user: process.env.IMAP_USER || "",
  password: process.env.IMAP_PASSWORD || "",
  tls: process.env.IMAP_TLS !== "false", // по умолчанию true
};

/**
 * Проверка наличия обязательной конфигурации IMAP
 */
function validateImapConfig(): boolean {
  const missing: string[] = [];
  if (!emailConfig.host) missing.push("IMAP_HOST");
  if (!emailConfig.user) missing.push("IMAP_USER");
  if (!emailConfig.password) missing.push("IMAP_PASSWORD");

  if (missing.length > 0) {
    console.warn(
      `[Email Receiver] ⚠️ IMAP не настроен. Отсутствуют: ${missing.join(", ")}`,
    );
    return false;
  }
  return true;
}

// Директория для вложений
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads", "tickets");

/**
 * Основная функция для проверки новых писем
 */
export async function checkNewEmails(): Promise<void> {
  console.log("[Email Receiver] Проверка новых писем...");

  if (!validateImapConfig()) {
    console.error(
      "[Email Receiver] IMAP не настроен, пропускаем проверку писем",
    );
    return;
  }

  const imap = new Imap({
    user: emailConfig.user,
    password: emailConfig.password,
    host: emailConfig.host,
    port: emailConfig.port,
    tls: emailConfig.tls,
    tlsOptions: { rejectUnauthorized: false },
  });

  return new Promise((resolve, reject) => {
    imap.once("ready", () => {
      imap.openBox("INBOX", false, async (err, box) => {
        if (err) {
          console.error("[Email Receiver] Ошибка открытия INBOX:", err);
          imap.end();
          return reject(err);
        }

        // Ищем непрочитанные письма
        imap.search(["UNSEEN"], async (err, results) => {
          if (err) {
            console.error("[Email Receiver] Ошибка поиска писем:", err);
            imap.end();
            return reject(err);
          }

          if (results.length === 0) {
            console.log("[Email Receiver] Новых писем нет");
            imap.end();
            return resolve();
          }

          console.log(
            `[Email Receiver] Найдено новых писем: ${results.length}`,
          );

          const fetch = imap.fetch(results, { bodies: "", markSeen: true });

          fetch.on("message", (msg) => {
            msg.on("body", async (stream) => {
              try {
                const parsed = await simpleParser(stream);
                await processEmail(parsed);
              } catch (error) {
                console.error(
                  "[Email Receiver] Ошибка обработки письма:",
                  error,
                );
              }
            });
          });

          fetch.once("error", (err) => {
            console.error("[Email Receiver] Ошибка fetch:", err);
            reject(err);
          });

          fetch.once("end", () => {
            console.log("[Email Receiver] Обработка завершена");
            imap.end();
            resolve();
          });
        });
      });
    });

    imap.once("error", (err) => {
      console.error("[Email Receiver] IMAP ошибка:", err);
      reject(err);
    });

    imap.connect();
  });
}

/**
 * Обработка одного письма
 */
async function processEmail(mail: ParsedMail): Promise<void> {
  console.log(`[Email Receiver] Обработка письма от: ${mail.from?.text}`);

  try {
    // Парсим данные
    const emailData = await parseEmailToTicket(mail);

    // Проверяем, является ли это ответом на существующий тикет
    const existingTicket = await findTicketByEmailReply(emailData);

    if (existingTicket) {
      // Это ответ на существующий тикет
      if (existingTicket.status === "closed") {
        console.log(
          `[Email Receiver] Тикет #${existingTicket.id.substring(0, 8)} закрыт, создаем новый тикет`,
        );
        await createTicketFromEmail(emailData);
      } else {
        console.log(
          `[Email Receiver] Найден открытый тикет #${existingTicket.id.substring(0, 8)}, создаем комментарий`,
        );
        await createCommentFromEmail(existingTicket.id, emailData);
      }
    } else {
      // Новый тикет
      await createTicketFromEmail(emailData);
    }
  } catch (error) {
    console.error("[Email Receiver] Ошибка при обработке письма:", error);
  }
}

/**
 * Поиск тикета по email threading headers или теме
 */
async function findTicketByEmailReply(
  emailData: ParsedTicketData,
): Promise<FoundTicket | null> {
  const client = await pool.connect();

  try {
    // 1. Ищем по In-Reply-To header в tickets.email_message_id
    if (emailData.inReplyTo) {
      const ticketByInReplyTo = await client.query(
        `SELECT id, status, email_message_id, email_subject FROM tickets
         WHERE email_message_id = $1`,
        [emailData.inReplyTo],
      );
      if (ticketByInReplyTo.rows.length > 0) {
        console.log(`[Email Receiver] Найден тикет по In-Reply-To header`);
        return ticketByInReplyTo.rows[0];
      }

      // 2. Ищем по In-Reply-To header в ticket_comments.email_message_id
      const commentByInReplyTo = await client.query(
        `SELECT t.id, t.status, t.email_message_id, t.email_subject
         FROM ticket_comments tc
         JOIN tickets t ON t.id = tc.ticket_id
         WHERE tc.email_message_id = $1`,
        [emailData.inReplyTo],
      );
      if (commentByInReplyTo.rows.length > 0) {
        console.log(`[Email Receiver] Найден тикет по комментарию In-Reply-To`);
        return commentByInReplyTo.rows[0];
      }
    }

    // 3. Ищем по References header
    if (emailData.references && emailData.references.length > 0) {
      const ticketByReferences = await client.query(
        `SELECT id, status, email_message_id, email_subject FROM tickets
         WHERE email_message_id = ANY($1)`,
        [emailData.references],
      );
      if (ticketByReferences.rows.length > 0) {
        console.log(`[Email Receiver] Найден тикет по References header`);
        return ticketByReferences.rows[0];
      }

      const commentByReferences = await client.query(
        `SELECT t.id, t.status, t.email_message_id, t.email_subject
         FROM ticket_comments tc
         JOIN tickets t ON t.id = tc.ticket_id
         WHERE tc.email_message_id = ANY($1)`,
        [emailData.references],
      );
      if (commentByReferences.rows.length > 0) {
        console.log(`[Email Receiver] Найден тикет по комментарию References`);
        return commentByReferences.rows[0];
      }
    }

    // 4. Фоллбэк: парсинг темы Re: [Ticket #xxxxxxxx]
    const ticketIdMatch = emailData.subject.match(/\[Ticket #([a-f0-9]{8})\]/i);
    if (ticketIdMatch) {
      const shortId = ticketIdMatch[1];
      console.log(`[Email Receiver] Найден ID тикета в теме: ${shortId}`);

      const ticketBySubject = await client.query(
        `SELECT id, status, email_message_id, email_subject FROM tickets
         WHERE id::text LIKE $1`,
        [`${shortId}%`],
      );
      if (ticketBySubject.rows.length > 0) {
        console.log(`[Email Receiver] Найден тикет по теме письма`);
        return ticketBySubject.rows[0];
      }
    }

    return null;
  } finally {
    client.release();
  }
}

/**
 * Создание комментария из email-ответа
 */
async function createCommentFromEmail(
  ticketId: string,
  emailData: ParsedTicketData,
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Проверяем, существует ли пользователь с таким email
    const userResult = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [emailData.from],
    );

    const userId = userResult.rows.length > 0 ? userResult.rows[0].id : null;
    const emailSender = userId ? null : emailData.from;

    // Создаем комментарий
    const commentResult = await client.query(
      `INSERT INTO ticket_comments (
        ticket_id, user_id, content, attachments,
        is_from_email, email_message_id, email_sender,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *`,
      [
        ticketId,
        userId,
        emailData.body,
        emailData.attachments.length > 0 ? emailData.attachments : null,
        true, // is_from_email
        emailData.messageId || null,
        emailSender,
      ],
    );

    // Обновляем updated_at тикета
    await client.query("UPDATE tickets SET updated_at = NOW() WHERE id = $1", [
      ticketId,
    ]);

    await client.query("COMMIT");

    const comment = commentResult.rows[0];
    console.log(
      `[Email Receiver] ✅ Комментарий создан для тикета #${ticketId.substring(0, 8)}`,
    );
    console.log(`[Email Receiver]    От: ${emailData.from}`);
    if (emailData.attachments.length > 0) {
      console.log(
        `[Email Receiver]    Вложения: ${emailData.attachments.length}`,
      );
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Email Receiver] Ошибка создания комментария:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Парсинг письма в данные тикета
 */
async function parseEmailToTicket(mail: ParsedMail): Promise<ParsedTicketData> {
  // Извлекаем email отправителя
  const from = mail.from?.value[0]?.address || "unknown@example.com";

  // Тема письма
  const subject = mail.subject || "Без темы";

  // Тело письма (текст или HTML)
  let body = mail.text || "";

  // Если нет текстовой версии, используем HTML (убираем теги)
  if (!body && mail.html) {
    body = mail.html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  if (!body) {
    body = "Нет содержимого";
  }

  // Парсим категорию и приоритет из темы
  const { category, priority } = parseCategoryAndPriority(subject);

  // Обрабатываем вложения
  const attachmentPaths = await saveAttachments(mail.attachments || [], from);

  // Извлекаем email headers для threading
  // Используем any для доступа к headers, т.к. типы mailparser неполные
  const mailAny = mail as any;
  const messageId = mailAny.messageId || undefined;
  const inReplyTo = mailAny.inReplyTo || undefined;
  const references = mailAny.references
    ? Array.isArray(mailAny.references)
      ? mailAny.references
      : [mailAny.references]
    : undefined;

  return {
    from,
    subject,
    body,
    category,
    priority,
    attachments: attachmentPaths,
    messageId,
    inReplyTo,
    references,
  };
}

/**
 * Парсинг категории и приоритета из темы письма
 * Примеры:
 * "[Hardware][Critical] Не работает компьютер" → hardware, critical
 * "[Software] Проблема с 1С" → software, medium
 * "Срочно: Сломался принтер" → other, critical
 */
function parseCategoryAndPriority(subject: string): {
  category: "hardware" | "software" | "network" | "other";
  priority: "low" | "medium" | "high" | "critical";
} {
  const subjectLower = subject.toLowerCase();

  // Парсинг категории
  let category: "hardware" | "software" | "network" | "other" = "other";

  if (
    /\[hardware\]|железо|оборудование|компьютер|принтер|монитор|клавиатура|мышь/i.test(
      subject,
    )
  ) {
    category = "hardware";
  } else if (/\[software\]|по|программа|1с|софт|приложение/i.test(subject)) {
    category = "software";
  } else if (/\[network\]|сеть|интернет|wi-?fi|роутер|свитч/i.test(subject)) {
    category = "network";
  }

  // Парсинг приоритета
  let priority: "low" | "medium" | "high" | "critical" = "medium";

  if (/\[critical\]|срочно|критично|авария|немедленно/i.test(subject)) {
    priority = "critical";
  } else if (/\[high\]|важно|высокий/i.test(subject)) {
    priority = "high";
  } else if (/\[low\]|низкий|несрочно/i.test(subject)) {
    priority = "low";
  }

  return { category, priority };
}

/**
 * Получение расширения файла по MIME-типу
 */
function getExtensionFromMimeType(contentType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      ".xlsx",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      ".pptx",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "application/zip": ".zip",
    "application/x-rar-compressed": ".rar",
    "application/x-7z-compressed": ".7z",
    "application/gzip": ".gz",
  };

  // Берём только основную часть MIME-типа (без charset и т.п.)
  const baseMime = contentType.split(";")[0].trim().toLowerCase();
  return mimeToExt[baseMime] || "";
}

/**
 * Сохранение вложений на диск
 */
async function saveAttachments(
  attachments: Attachment[],
  senderEmail: string,
): Promise<string[]> {
  const savedPaths: string[] = [];

  // Создаем директорию для загрузок, если не существует
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  console.log(`[Email Receiver] Всего вложений: ${attachments.length}`);
  for (const attachment of attachments) {
    console.log(
      `[Email Receiver] Вложение: filename="${attachment.filename}", contentType="${attachment.contentType}", size=${attachment.size}, contentDisposition="${attachment.contentDisposition}"`,
    );
    try {
      // Определяем расширение файла
      let ext = "";
      let originalFilename = attachment.filename || "";

      if (originalFilename && path.extname(originalFilename)) {
        // Есть filename с расширением
        ext = path.extname(originalFilename).toLowerCase();
      } else if (attachment.contentType) {
        // Нет filename или расширения - определяем по MIME-типу (для inline-картинок)
        ext = getExtensionFromMimeType(attachment.contentType);
        if (!originalFilename) {
          originalFilename = `inline-image${ext}`;
        }
      }

      // Проверка типа файла (безопасность)
      if (!ext || !isAllowedFileType(`file${ext}`)) {
        console.warn(
          `[Email Receiver] Пропущен небезопасный файл: ${originalFilename || "без имени"} (ext: ${ext}, contentType: ${attachment.contentType})`,
        );
        continue;
      }

      // Генерируем уникальное имя файла
      const filename = `${uuidv4()}${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      // Сохраняем файл (проверяем наличие content)
      if (!attachment.content) {
        console.warn(
          `[Email Receiver] Вложение ${originalFilename} не имеет содержимого, пропущено`,
        );
        continue;
      }
      await fs.writeFile(filepath, attachment.content);

      // Сохраняем относительный путь для базы данных
      savedPaths.push(`/uploads/tickets/${filename}`);

      console.log(
        `[Email Receiver] Сохранено вложение: ${filename} (${originalFilename})`,
      );
    } catch (error) {
      console.error(
        `[Email Receiver] Ошибка сохранения вложения ${attachment.filename}:`,
        error,
      );
    }
  }

  return savedPaths;
}

/**
 * Проверка допустимых типов файлов
 */
function isAllowedFileType(filename: string): boolean {
  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".bmp",
    ".webp",
    ".svg", // Изображения
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx", // Документы Office
    ".txt",
    ".log",
    ".csv", // Текстовые
    ".zip",
    ".rar",
    ".7z",
    ".tar",
    ".gz", // Архивы
  ];

  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Создание тикета из email
 */
async function createTicketFromEmail(data: ParsedTicketData): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Проверяем, существует ли пользователь с таким email
    const userResult = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [data.from],
    );

    let creatorId: string | null = null;
    let status: string;
    let emailSender: string | null = null;

    if (userResult.rows.length > 0) {
      // Случай A: Пользователь найден
      creatorId = userResult.rows[0].id;
      status = "new";
      console.log(`[Email Receiver] Пользователь найден: ${data.from}`);
    } else {
      // Случай B: Пользователь не найден
      creatorId = null;
      status = "pending_user";
      emailSender = data.from;
      console.log(
        `[Email Receiver] Пользователь не найден: ${data.from}, тикет требует привязки`,
      );
    }

    // Создаем тикет
    const ticketResult = await client.query(
      `INSERT INTO tickets (
        title, description, category, priority, status,
        creator_id, email_sender, created_via, attachments,
        email_message_id, email_subject,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *`,
      [
        data.subject,
        data.body,
        data.category,
        data.priority,
        status,
        creatorId,
        emailSender,
        "email",
        data.attachments.length > 0 ? data.attachments : null,
        data.messageId || null,
        data.subject, // Сохраняем оригинальную тему для Re:
      ],
    );

    await client.query("COMMIT");

    const ticket = ticketResult.rows[0];
    console.log(
      `[Email Receiver] ✅ Тикет создан: #${ticket.id.substring(0, 8)} (статус: ${status})`,
    );
    console.log(`[Email Receiver]    Тема: ${data.subject}`);
    console.log(
      `[Email Receiver]    Категория: ${data.category}, Приоритет: ${data.priority}`,
    );
    if (data.attachments.length > 0) {
      console.log(`[Email Receiver]    Вложения: ${data.attachments.length}`);
    }
    if (data.messageId) {
      console.log(`[Email Receiver]    Message-ID: ${data.messageId}`);
    }
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("[Email Receiver] Ошибка создания тикета:", error);
    throw error;
  } finally {
    client.release();
  }
}
