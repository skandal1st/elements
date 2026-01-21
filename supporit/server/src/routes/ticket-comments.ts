import { Router, Response } from "express";
import { pool } from "../config/database.js";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth.js";
import { notifyTicketComment } from "../services/notification.service.js";
import { sendTicketReplyEmail } from "../services/email-sender.service.js";

const router = Router();

// Получить комментарии к заявке
router.get(
  "/ticket/:ticketId",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { ticketId } = req.params;

      // Проверяем доступ к заявке
      const ticketResult = await pool.query(
        "SELECT * FROM tickets WHERE id = $1",
        [ticketId],
      );
      if (ticketResult.rows.length === 0) {
        return res.status(404).json({ error: "Заявка не найдена" });
      }

      const ticket = ticketResult.rows[0];

      // Обычные сотрудники могут видеть только комментарии к своим заявкам
      if (req.userRole === "employee" && ticket.creator_id !== req.userId) {
        return res.status(403).json({ error: "Недостаточно прав доступа" });
      }

      // Загружаем комментарии с информацией о пользователях
      // LEFT JOIN для поддержки комментариев без user_id (из email)
      const result = await pool.query(
        `SELECT
        tc.id,
        tc.ticket_id,
        tc.user_id,
        tc.content,
        tc.attachments,
        tc.created_at,
        tc.is_from_email,
        tc.email_message_id,
        tc.email_sender,
        u.full_name as user_name,
        u.role as user_role
       FROM ticket_comments tc
       LEFT JOIN users u ON tc.user_id = u.id
       WHERE tc.ticket_id = $1
       ORDER BY tc.created_at ASC`,
        [ticketId],
      );

      res.json({ data: result.rows });
    } catch (error) {
      console.error("Ошибка получения комментариев:", error);
      res.status(500).json({ error: "Ошибка при получении комментариев" });
    }
  },
);

// Создать комментарий
router.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { ticket_id, content, attachments } = req.body;

    if (!ticket_id || !content) {
      return res.status(400).json({ error: "ticket_id и content обязательны" });
    }

    // Проверяем доступ к заявке
    const ticketResult = await pool.query(
      "SELECT * FROM tickets WHERE id = $1",
      [ticket_id],
    );
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: "Заявка не найдена" });
    }

    const ticket = ticketResult.rows[0];

    // Обычные сотрудники могут комментировать только свои заявки
    if (req.userRole === "employee" && ticket.creator_id !== req.userId) {
      return res.status(403).json({ error: "Недостаточно прав доступа" });
    }

    // Создаем комментарий
    const result = await pool.query(
      `INSERT INTO ticket_comments (ticket_id, user_id, content, attachments, is_from_email, created_at)
       VALUES ($1, $2, $3, $4, FALSE, NOW())
       RETURNING *`,
      [ticket_id, req.userId, content, attachments || null],
    );

    const comment = result.rows[0];

    // Загружаем информацию о пользователе
    const userResult = await pool.query(
      "SELECT full_name, role FROM users WHERE id = $1",
      [req.userId],
    );

    const commentWithUser = {
      ...comment,
      user_name: userResult.rows[0]?.full_name,
      user_role: userResult.rows[0]?.role,
    };

    // Отправляем уведомления всем участникам заявки
    // Собираем список пользователей: создатель и исполнитель
    const usersToNotify = new Set<string>();

    if (ticket.creator_id && ticket.creator_id !== req.userId) {
      usersToNotify.add(ticket.creator_id);
    }

    if (ticket.assignee_id && ticket.assignee_id !== req.userId) {
      usersToNotify.add(ticket.assignee_id);
    }

    // Также уведомляем всех, кто оставлял комментарии (кроме текущего пользователя)
    const previousCommentersResult = await pool.query(
      `SELECT DISTINCT user_id FROM ticket_comments
       WHERE ticket_id = $1 AND user_id != $2 AND user_id IS NOT NULL`,
      [ticket_id, req.userId],
    );

    previousCommentersResult.rows.forEach((row: any) => {
      usersToNotify.add(row.user_id);
    });

    // Отправляем уведомления
    const commenterName = userResult.rows[0]?.full_name || "Пользователь";
    for (const userId of usersToNotify) {
      await notifyTicketComment(userId, ticket_id, ticket.title, commenterName);
    }

    res.status(201).json({ data: commentWithUser });
  } catch (error) {
    console.error("Ошибка создания комментария:", error);
    res.status(500).json({ error: "Ошибка при создании комментария" });
  }
});

// Отправить ответ по email
router.post(
  "/email-reply",
  authenticate,
  requireRole("admin", "it_specialist"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ticket_id, content } = req.body;

      if (!ticket_id || !content) {
        return res
          .status(400)
          .json({ error: "ticket_id и content обязательны" });
      }

      // Проверяем SMTP
      if (process.env.SMTP_ENABLED !== "true") {
        return res.status(400).json({ error: "Email отправка не настроена" });
      }

      // Получаем тикет с информацией о создателе
      const ticketResult = await pool.query(
        `SELECT t.*, u.email as creator_email, u.full_name as creator_name
       FROM tickets t
       LEFT JOIN users u ON t.creator_id = u.id
       WHERE t.id = $1`,
        [ticket_id],
      );

      if (ticketResult.rows.length === 0) {
        return res.status(404).json({ error: "Заявка не найдена" });
      }

      const ticket = ticketResult.rows[0];

      // Определяем email получателя
      const recipientEmail = ticket.email_sender || ticket.creator_email;

      if (!recipientEmail) {
        return res.status(400).json({ error: "Не найден email получателя" });
      }

      // Получаем информацию об отправителе (текущий пользователь)
      const senderResult = await pool.query(
        "SELECT full_name FROM users WHERE id = $1",
        [req.userId],
      );
      const senderName = senderResult.rows[0]?.full_name || "IT-специалист";

      // Определяем тему письма
      const ticketSubject = ticket.email_subject || ticket.title;

      // Отправляем email и получаем Message-ID
      const messageId = await sendTicketReplyEmail(
        recipientEmail,
        ticket.id,
        ticketSubject,
        content,
        senderName,
        ticket.email_message_id || undefined, // In-Reply-To
        undefined, // References (можно добавить позже)
      );

      // Создаем комментарий с информацией об отправленном email
      const commentResult = await pool.query(
        `INSERT INTO ticket_comments (
        ticket_id, user_id, content, attachments,
        is_from_email, email_message_id,
        created_at
      ) VALUES ($1, $2, $3, NULL, FALSE, $4, NOW())
       RETURNING *`,
        [ticket_id, req.userId, content, messageId],
      );

      const comment = commentResult.rows[0];

      // Обновляем updated_at тикета
      await pool.query("UPDATE tickets SET updated_at = NOW() WHERE id = $1", [
        ticket_id,
      ]);

      const commentWithUser = {
        ...comment,
        user_name: senderName,
        user_role: req.userRole,
      };

      res.status(201).json({
        data: commentWithUser,
        message: `Ответ отправлен на ${recipientEmail}`,
      });
    } catch (error) {
      console.error("Ошибка отправки email-ответа:", error);
      res.status(500).json({ error: "Ошибка при отправке email-ответа" });
    }
  },
);

// Обновить комментарий
router.put("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "content обязателен" });
    }

    // Проверяем существование комментария и права доступа
    const existingResult = await pool.query(
      "SELECT * FROM ticket_comments WHERE id = $1",
      [id],
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Комментарий не найден" });
    }

    const existingComment = existingResult.rows[0];

    // Только автор комментария может его редактировать
    // Комментарии из email (без user_id) нельзя редактировать
    if (!existingComment.user_id || existingComment.user_id !== req.userId) {
      return res.status(403).json({ error: "Недостаточно прав доступа" });
    }

    // Обновляем комментарий
    const result = await pool.query(
      `UPDATE ticket_comments
       SET content = $1
       WHERE id = $2
       RETURNING *`,
      [content, id],
    );

    // Загружаем информацию о пользователе
    const userResult = await pool.query(
      "SELECT full_name, role FROM users WHERE id = $1",
      [existingComment.user_id],
    );

    const commentWithUser = {
      ...result.rows[0],
      user_name: userResult.rows[0]?.full_name,
      user_role: userResult.rows[0]?.role,
    };

    res.json({ data: commentWithUser });
  } catch (error) {
    console.error("Ошибка обновления комментария:", error);
    res.status(500).json({ error: "Ошибка при обновлении комментария" });
  }
});

// Удалить комментарий
router.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Проверяем существование комментария и права доступа
    const existingResult = await pool.query(
      "SELECT * FROM ticket_comments WHERE id = $1",
      [id],
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: "Комментарий не найден" });
    }

    const existingComment = existingResult.rows[0];

    // Только автор комментария или админ/IT-специалист могут удалять
    // Для комментариев из email (без user_id) только админ/IT-специалист
    const isAuthor =
      existingComment.user_id && existingComment.user_id === req.userId;
    const isStaff =
      req.userRole === "admin" || req.userRole === "it_specialist";

    if (!isAuthor && !isStaff) {
      return res.status(403).json({ error: "Недостаточно прав доступа" });
    }

    // Удаляем комментарий
    await pool.query("DELETE FROM ticket_comments WHERE id = $1", [id]);

    res.json({ message: "Комментарий удален" });
  } catch (error) {
    console.error("Ошибка удаления комментария:", error);
    res.status(500).json({ error: "Ошибка при удалении комментария" });
  }
});

export default router;
