/**
 * Email Sender Service
 * Отправка email-уведомлений через SMTP
 */

import nodemailer, { Transporter } from "nodemailer";

// Конфигурация SMTP (все значения должны быть в .env)
const smtpConfig = {
  host: process.env.SMTP_HOST || "",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // true для 465, false для других портов
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASSWORD || "",
  },
};

// Email отправителя (обязательные переменные окружения)
const FROM_EMAIL = process.env.FROM_EMAIL || "";
const FROM_NAME = process.env.FROM_NAME || "SupporIT";

// Домен для Message-ID
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN || "supporit.local";

/**
 * Проверка наличия обязательной конфигурации SMTP
 */
function validateSmtpConfig(): void {
  const missing: string[] = [];
  if (!smtpConfig.host) missing.push("SMTP_HOST");
  if (!smtpConfig.auth.user) missing.push("SMTP_USER");
  if (!smtpConfig.auth.pass) missing.push("SMTP_PASSWORD");
  if (!FROM_EMAIL) missing.push("FROM_EMAIL");

  if (missing.length > 0) {
    console.warn(
      `[Email Sender] ⚠️ SMTP не настроен. Отсутствуют: ${missing.join(", ")}`,
    );
  }
}

// Проверяем конфигурацию при загрузке модуля
validateSmtpConfig();

// Создаем транспортер
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport(smtpConfig);
  }
  if (!transporter) {
    throw new Error("Failed to create SMTP transporter");
  }
  return transporter;
}

/**
 * Генерация уникального Message-ID
 */
function generateMessageId(ticketId: string, suffix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const suffixPart = suffix ? `-${suffix}` : "";
  return `<ticket-${ticketId.substring(0, 8)}-${timestamp}-${random}${suffixPart}@${EMAIL_DOMAIN}>`;
}

/**
 * Отправить email-уведомление о смене статуса тикета
 */
export async function sendTicketStatusEmail(
  toEmail: string,
  ticketId: string,
  ticketTitle: string,
  newStatus: string,
  assigneeName?: string,
): Promise<void> {
  try {
    const subject = getEmailSubject(newStatus, ticketId);
    const html = getEmailTemplate(
      newStatus,
      ticketId,
      ticketTitle,
      assigneeName,
    );

    await getTransporter().sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: toEmail,
      subject,
      html,
    });

    console.log(`[Email Sender] ✅ Отправлено уведомление на ${toEmail}`);
    console.log(
      `[Email Sender]    Тикет: #${ticketId.substring(0, 8)}, Статус: ${newStatus}`,
    );
  } catch (error) {
    console.error(
      `[Email Sender] ❌ Ошибка отправки email на ${toEmail}:`,
      error,
    );
    throw error;
  }
}

/**
 * Отправить email-ответ на тикет (для IT-специалистов)
 * Возвращает Message-ID отправленного письма
 */
export async function sendTicketReplyEmail(
  toEmail: string,
  ticketId: string,
  ticketSubject: string,
  replyContent: string,
  senderName: string,
  inReplyTo?: string,
  references?: string[],
): Promise<string> {
  try {
    const shortId = ticketId.substring(0, 8);
    const messageId = generateMessageId(ticketId, "reply");

    // Формируем тему с Re: и номером тикета
    const subject = `Re: [Ticket #${shortId}] ${ticketSubject}`;

    // HTML шаблон для ответа
    const html = getReplyEmailTemplate(
      ticketId,
      ticketSubject,
      replyContent,
      senderName,
    );

    // Формируем References header
    const refsHeader =
      references && references.length > 0
        ? [...references, inReplyTo].filter(Boolean).join(" ")
        : inReplyTo || "";

    const mailOptions: any = {
      from: `"${senderName} (${FROM_NAME})" <${FROM_EMAIL}>`,
      to: toEmail,
      subject,
      html,
      messageId,
    };

    // Добавляем threading headers если есть
    if (inReplyTo) {
      mailOptions.inReplyTo = inReplyTo;
    }
    if (refsHeader) {
      mailOptions.references = refsHeader;
    }

    await getTransporter().sendMail(mailOptions);

    console.log(`[Email Sender] ✅ Отправлен ответ на ${toEmail}`);
    console.log(`[Email Sender]    Тикет: #${shortId}`);
    console.log(`[Email Sender]    Message-ID: ${messageId}`);

    return messageId;
  } catch (error) {
    console.error(
      `[Email Sender] ❌ Ошибка отправки ответа на ${toEmail}:`,
      error,
    );
    throw error;
  }
}

/**
 * Тема письма в зависимости от статуса
 */
function getEmailSubject(status: string, ticketId: string): string {
  const shortId = ticketId.substring(0, 8);

  switch (status) {
    case "in_progress":
      return `Заявка #${shortId} принята в работу`;
    case "resolved":
      return `Заявка #${shortId} решена`;
    case "closed":
      return `Заявка #${shortId} закрыта`;
    default:
      return `Обновление статуса заявки #${shortId}`;
  }
}

/**
 * HTML-шаблон письма для ответа IT-специалиста
 */
function getReplyEmailTemplate(
  ticketId: string,
  ticketSubject: string,
  replyContent: string,
  senderName: string,
): string {
  const shortId = ticketId.substring(0, 8);

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ответ по заявке #${shortId}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">

  <!-- Header -->
  <div style="background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 18px; font-weight: 600;">
      Ответ по заявке #${shortId}
    </h1>
    <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">${ticketSubject}</p>
  </div>

  <!-- Content -->
  <div style="background-color: #ffffff; padding: 25px; border: 1px solid #e5e7eb; border-top: none;">

    <!-- Sender info -->
    <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #f3f4f6;">
      <p style="margin: 0; font-size: 14px; color: #6b7280;">
        <strong style="color: #111827;">${senderName}</strong> ответил на вашу заявку:
      </p>
    </div>

    <!-- Reply content -->
    <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; font-size: 14px; color: #374151; white-space: pre-wrap;">${escapeHtml(replyContent)}</p>
    </div>

    <!-- Reply instruction -->
    <div style="margin-top: 25px; padding: 15px; background-color: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px;">
      <p style="margin: 0; font-size: 13px; color: #065f46;">
        <strong>Вы можете ответить на это письмо</strong>, и ваш ответ будет добавлен к заявке.
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="background-color: #ffffff; padding: 15px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
      © ${new Date().getFullYear()} SupporIT. Система управления IT-заявками.
    </p>
  </div>

</body>
</html>
  `;
}

/**
 * Экранирование HTML
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * HTML-шаблон письма для уведомлений о статусе
 */
function getEmailTemplate(
  status: string,
  ticketId: string,
  ticketTitle: string,
  assigneeName?: string,
): string {
  let message = "";
  let statusColor = "#3b82f6";
  let statusText = "";

  switch (status) {
    case "in_progress":
      message = "Ваша заявка принята в работу";
      statusText = "В работе";
      statusColor = "#f59e0b";
      break;
    case "resolved":
      message = "Ваша заявка решена";
      statusText = "Решена";
      statusColor = "#10b981";
      break;
    case "closed":
      message = "Ваша заявка закрыта";
      statusText = "Закрыта";
      statusColor = "#6b7280";
      break;
    default:
      message = "Статус вашей заявки изменен";
      statusText = status;
  }

  const shortId = ticketId.substring(0, 8);

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getEmailSubject(status, ticketId)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">

  <!-- Header -->
  <div style="background-color: ${statusColor}; color: white; padding: 30px 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${message}</h1>
  </div>

  <!-- Content -->
  <div style="background-color: #ffffff; padding: 30px 20px; border: 1px solid #e5e7eb; border-top: none;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <strong style="color: #6b7280; font-size: 14px;">Номер заявки:</strong>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
          <span style="font-family: monospace; background-color: #f3f4f6; padding: 4px 8px; border-radius: 4px; font-size: 14px;">#${shortId}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <strong style="color: #6b7280; font-size: 14px;">Название:</strong>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
          <span style="font-size: 14px;">${ticketTitle}</span>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">
          <strong style="color: #6b7280; font-size: 14px;">Статус:</strong>
        </td>
        <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">
          <span style="background-color: ${statusColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500;">${statusText}</span>
        </td>
      </tr>
      ${
        assigneeName
          ? `
      <tr>
        <td style="padding: 10px 0;">
          <strong style="color: #6b7280; font-size: 14px;">Исполнитель:</strong>
        </td>
        <td style="padding: 10px 0; text-align: right;">
          <span style="font-size: 14px;">${assigneeName}</span>
        </td>
      </tr>
      `
          : ""
      }
    </table>

    <div style="margin-top: 30px; padding: 20px; background-color: #f9fafb; border-radius: 6px; border-left: 4px solid ${statusColor};">
      <p style="margin: 0; font-size: 14px; color: #4b5563;">
        ${
          status === "in_progress"
            ? "Наш специалист уже работает над решением вашей проблемы."
            : status === "resolved"
              ? "Ваша проблема была успешно решена. Если у вас остались вопросы, пожалуйста, сообщите нам."
              : "Для просмотра деталей заявки, пожалуйста, войдите в систему SupporIT."
        }
      </p>
    </div>
  </div>

  <!-- Footer -->
  <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <div style="padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 15px;">
      <p style="margin: 0; font-size: 13px; color: #92400e;">
        <strong>Важно:</strong> Это автоматическое уведомление. Пожалуйста, не отвечайте на это письмо.
      </p>
    </div>

    <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
      © ${new Date().getFullYear()} SupporIT. Система управления IT-заявками.
    </p>
  </div>

</body>
</html>
  `;
}

/**
 * Проверка подключения к SMTP
 */
export async function verifySmtpConnection(): Promise<boolean> {
  try {
    await getTransporter().verify();
    console.log("[Email Sender] ✅ SMTP соединение успешно установлено");
    return true;
  } catch (error) {
    console.error("[Email Sender] ❌ Ошибка SMTP соединения:", error);
    return false;
  }
}
