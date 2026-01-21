import { get, post, put, del } from "../lib/api";
import type { TicketComment } from "../types";

export const ticketCommentsService = {
  // Получить комментарии к заявке
  async getComments(ticketId: string): Promise<{
    data: TicketComment[];
    error: Error | null;
  }> {
    try {
      const { data, error } = await get<{ data: TicketComment[] }>(
        `/ticket-comments/ticket/${ticketId}`,
      );

      if (error || !data) {
        return {
          data: [],
          error: error || new Error("Ошибка загрузки комментариев"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: [], error: error as Error };
    }
  },

  // Создать комментарий
  async createComment(
    ticketId: string,
    content: string,
    attachments?: string[],
  ): Promise<{ data: TicketComment | null; error: Error | null }> {
    try {
      const { data, error } = await post<{ data: TicketComment }>(
        "/ticket-comments",
        {
          ticket_id: ticketId,
          content,
          attachments,
        },
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Ошибка создания комментария"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Обновить комментарий
  async updateComment(
    commentId: string,
    content: string,
  ): Promise<{ data: TicketComment | null; error: Error | null }> {
    try {
      const { data, error } = await put<{ data: TicketComment }>(
        `/ticket-comments/${commentId}`,
        { content },
      );

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Ошибка обновления комментария"),
        };
      }

      return { data: data.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Удалить комментарий
  async deleteComment(commentId: string): Promise<{ error: Error | null }> {
    try {
      const { error } = await del(`/ticket-comments/${commentId}`);

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  },

  // Отправить ответ по email
  async sendEmailReply(
    ticketId: string,
    content: string,
  ): Promise<{
    data: TicketComment | null;
    message?: string;
    error: Error | null;
  }> {
    try {
      const { data, error } = await post<{
        data: TicketComment;
        message?: string;
      }>("/ticket-comments/email-reply", {
        ticket_id: ticketId,
        content,
      });

      if (error || !data) {
        return {
          data: null,
          error: error || new Error("Ошибка отправки email-ответа"),
        };
      }

      return { data: data.data, message: data.message, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },
};
