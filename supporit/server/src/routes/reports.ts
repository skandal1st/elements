import { Router, Response } from "express";
import { pool } from "../config/database.js";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// Отчёт по заявкам
router.get(
  "/tickets",
  authenticate,
  requireRole("admin", "it_specialist"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { date_from, date_to, category, priority } = req.query;

      if (!date_from || !date_to) {
        return res.status(400).json({
          error: "Параметры date_from и date_to обязательны",
        });
      }

      // Преобразуем даты для включения всего дня
      const dateFromStart = `${date_from}T00:00:00.000Z`;
      const dateToEnd = `${date_to}T23:59:59.999Z`;

      // 1. Сводная статистика
      const summaryQuery = `
        SELECT
          COUNT(*)::int as total_tickets,
          COUNT(*) FILTER (WHERE status IN ('new', 'in_progress', 'waiting', 'pending_user'))::int as open_tickets,
          COUNT(*) FILTER (WHERE status = 'resolved')::int as resolved_tickets,
          COUNT(*) FILTER (WHERE status = 'closed')::int as closed_tickets,
          AVG(
            CASE
              WHEN resolved_at IS NOT NULL THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600
              WHEN closed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600
              ELSE NULL
            END
          ) as avg_resolution_time_hours,
          AVG(rating) as avg_rating
        FROM tickets
        WHERE created_at >= $1 AND created_at <= $2
          AND ($3::text IS NULL OR category = $3)
          AND ($4::text IS NULL OR priority = $4)
      `;

      const summaryResult = await pool.query(summaryQuery, [
        dateFromStart,
        dateToEnd,
        category || null,
        priority || null,
      ]);

      const summary = {
        total_tickets: summaryResult.rows[0].total_tickets || 0,
        open_tickets: summaryResult.rows[0].open_tickets || 0,
        resolved_tickets: summaryResult.rows[0].resolved_tickets || 0,
        closed_tickets: summaryResult.rows[0].closed_tickets || 0,
        avg_resolution_time_hours: summaryResult.rows[0].avg_resolution_time_hours
          ? parseFloat(summaryResult.rows[0].avg_resolution_time_hours)
          : null,
        avg_rating: summaryResult.rows[0].avg_rating
          ? parseFloat(summaryResult.rows[0].avg_rating)
          : null,
      };

      // 2. Статистика по статусам
      const byStatusQuery = `
        SELECT status, COUNT(*)::int as count
        FROM tickets
        WHERE created_at >= $1 AND created_at <= $2
          AND ($3::text IS NULL OR category = $3)
          AND ($4::text IS NULL OR priority = $4)
        GROUP BY status
        ORDER BY count DESC
      `;

      const byStatusResult = await pool.query(byStatusQuery, [
        dateFromStart,
        dateToEnd,
        category || null,
        priority || null,
      ]);

      // 3. Статистика по категориям
      const byCategoryQuery = `
        SELECT category, COUNT(*)::int as count
        FROM tickets
        WHERE created_at >= $1 AND created_at <= $2
          AND ($3::text IS NULL OR category = $3)
          AND ($4::text IS NULL OR priority = $4)
        GROUP BY category
        ORDER BY count DESC
      `;

      const byCategoryResult = await pool.query(byCategoryQuery, [
        dateFromStart,
        dateToEnd,
        category || null,
        priority || null,
      ]);

      // 4. Статистика по приоритетам
      const byPriorityQuery = `
        SELECT priority, COUNT(*)::int as count
        FROM tickets
        WHERE created_at >= $1 AND created_at <= $2
          AND ($3::text IS NULL OR category = $3)
          AND ($4::text IS NULL OR priority = $4)
        GROUP BY priority
        ORDER BY
          CASE priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END
      `;

      const byPriorityResult = await pool.query(byPriorityQuery, [
        dateFromStart,
        dateToEnd,
        category || null,
        priority || null,
      ]);

      // 5. Детализация по срокам выполнения
      const resolutionDetailsQuery = `
        SELECT
          t.id,
          t.title,
          t.category,
          t.priority,
          t.status,
          t.created_at,
          t.resolved_at,
          t.closed_at,
          CASE
            WHEN t.resolved_at IS NOT NULL THEN
              EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 3600
            WHEN t.closed_at IS NOT NULL THEN
              EXTRACT(EPOCH FROM (t.closed_at - t.created_at)) / 3600
            ELSE NULL
          END as resolution_time_hours,
          creator.full_name as creator_name,
          assignee.full_name as assignee_name
        FROM tickets t
        LEFT JOIN users creator ON t.creator_id = creator.id
        LEFT JOIN users assignee ON t.assignee_id = assignee.id
        WHERE t.created_at >= $1 AND t.created_at <= $2
          AND ($3::text IS NULL OR t.category = $3)
          AND ($4::text IS NULL OR t.priority = $4)
        ORDER BY t.created_at DESC
        LIMIT 100
      `;

      const resolutionDetailsResult = await pool.query(resolutionDetailsQuery, [
        dateFromStart,
        dateToEnd,
        category || null,
        priority || null,
      ]);

      const resolutionDetails = resolutionDetailsResult.rows.map((row: any) => ({
        ...row,
        resolution_time_hours: row.resolution_time_hours
          ? parseFloat(row.resolution_time_hours)
          : null,
      }));

      // 6. Топ пользователей по количеству заявок
      const topCreatorsQuery = `
        SELECT
          u.id as user_id,
          u.full_name as user_name,
          u.email as user_email,
          u.department,
          COUNT(t.id)::int as ticket_count
        FROM users u
        JOIN tickets t ON t.creator_id = u.id
        WHERE t.created_at >= $1 AND t.created_at <= $2
          AND ($3::text IS NULL OR t.category = $3)
          AND ($4::text IS NULL OR t.priority = $4)
        GROUP BY u.id, u.full_name, u.email, u.department
        ORDER BY ticket_count DESC
        LIMIT 10
      `;

      const topCreatorsResult = await pool.query(topCreatorsQuery, [
        dateFromStart,
        dateToEnd,
        category || null,
        priority || null,
      ]);

      res.json({
        data: {
          summary,
          by_status: byStatusResult.rows,
          by_category: byCategoryResult.rows,
          by_priority: byPriorityResult.rows,
          resolution_details: resolutionDetails,
          top_creators: topCreatorsResult.rows,
        },
      });
    } catch (error) {
      console.error("Ошибка получения отчёта по заявкам:", error);
      res.status(500).json({ error: "Ошибка при получении отчёта" });
    }
  }
);

export default router;
