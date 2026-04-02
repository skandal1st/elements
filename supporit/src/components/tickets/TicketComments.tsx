import { useState, useEffect } from "react";
import { MessageSquare, Send, Edit2, Trash2, Mail, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { ticketCommentsService } from "../../services/ticket-comments.service";
import { useAuthStore } from "../../store/auth.store";
import type { TicketComment } from "../../types";

interface TicketCommentsProps {
  ticketId: string;
  emailSender?: string;
  createdVia?: string;
  creatorEmail?: string;
}

export const TicketComments = ({
  ticketId,
  emailSender,
  creatorEmail,
}: TicketCommentsProps) => {
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailReplyContent, setEmailReplyContent] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);

  // Определяем email получателя для ответа
  const recipientEmail = emailSender || creatorEmail;

  // Показывать кнопку "Ответить по email" только для IT/admin и если есть email
  const canSendEmailReply =
    (user?.role === "admin" || user?.role === "it_specialist") &&
    recipientEmail;

  const loadComments = async () => {
    setLoading(true);
    try {
      const result = await ticketCommentsService.getComments(ticketId);
      if (!result.error) {
        setComments(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [ticketId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const result = await ticketCommentsService.createComment(
        ticketId,
        newComment.trim(),
      );
      if (!result.error) {
        setNewComment("");
        loadComments();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (comment: TicketComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      const result = await ticketCommentsService.updateComment(
        commentId,
        editContent.trim(),
      );
      if (!result.error) {
        setEditingId(null);
        setEditContent("");
        loadComments();
      }
    } catch (error) {
      console.error("Ошибка обновления комментария:", error);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Удалить комментарий?")) return;

    try {
      const result = await ticketCommentsService.deleteComment(commentId);
      if (!result.error) {
        loadComments();
      }
    } catch (error) {
      console.error("Ошибка удаления комментария:", error);
    }
  };

  const handleSendEmailReply = async () => {
    if (!emailReplyContent.trim()) return;

    setSendingEmail(true);
    setEmailError(null);
    setEmailSuccess(null);

    try {
      const result = await ticketCommentsService.sendEmailReply(
        ticketId,
        emailReplyContent.trim(),
      );
      if (result.error) {
        setEmailError(result.error.message || "Ошибка отправки");
      } else {
        setEmailSuccess(result.message || "Ответ отправлен");
        setEmailReplyContent("");
        loadComments();
        // Закрываем модал через 2 секунды после успеха
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailSuccess(null);
        }, 2000);
      }
    } catch (error) {
      setEmailError("Ошибка отправки email");
    } finally {
      setSendingEmail(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case "admin":
        return (
          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
            Администратор
          </span>
        );
      case "it_specialist":
        return (
          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
            ИТ-специалист
          </span>
        );
      default:
        return null;
    }
  };

  const getEmailBadge = (comment: TicketComment) => {
    if (comment.is_from_email) {
      return (
        <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 rounded flex items-center">
          <Mail className="h-3 w-3 mr-1" />
          Email
        </span>
      );
    }
    return null;
  };

  // Получаем отображаемое имя для комментария
  const getDisplayName = (comment: TicketComment) => {
    if (comment.user_name) {
      return comment.user_name;
    }
    if (comment.email_sender) {
      return comment.email_sender;
    }
    return "Пользователь";
  };

  // Получаем инициал для аватара
  const getInitial = (comment: TicketComment) => {
    const name = getDisplayName(comment);
    if (name.includes("@")) {
      // Для email берем первую букву до @
      return name.split("@")[0].charAt(0).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-lg font-semibold text-gray-900 dark:text-white">
          <MessageSquare className="h-5 w-5" />
          <h3>Комментарии ({comments.length})</h3>
        </div>

        {canSendEmailReply && (
          <button
            onClick={() => setShowEmailModal(true)}
            className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg transition-colors"
          >
            <Mail className="h-4 w-4 mr-1.5" />
            Ответить по email
          </button>
        )}
      </div>

      {/* Список комментариев */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
            Пока нет комментариев. Будьте первым!
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-lg p-4 space-y-2 ${
                comment.is_from_email
                  ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800"
                  : "bg-gray-50 dark:bg-gray-800"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      comment.is_from_email ? "bg-indigo-600" : "bg-primary-600"
                    }`}
                  >
                    {getInitial(comment)}
                  </div>
                  <div className="ml-3">
                    <div className="flex items-center flex-wrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {getDisplayName(comment)}
                      </p>
                      {getRoleBadge(comment.user_role)}
                      {getEmailBadge(comment)}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(comment.created_at), {
                        addSuffix: true,
                        locale: ru,
                      })}
                    </p>
                  </div>
                </div>

                {/* Кнопки редактирования/удаления */}
                {comment.user_id === user?.id && (
                  <div className="flex items-center space-x-2">
                    {editingId !== comment.id && (
                      <>
                        <button
                          onClick={() => handleEdit(comment)}
                          className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded"
                          title="Редактировать"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Контент комментария */}
              {editingId === comment.id ? (
                <div className="space-y-2 mt-2">
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    rows={3}
                  />
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleSaveEdit(comment.id)}
                      className="px-3 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                  {comment.content}
                </p>
              )}

              {/* Вложения комментария */}
              {comment.attachments && comment.attachments.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Вложения ({comment.attachments.length}):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {comment.attachments.map((path, idx) => {
                      const filename = path.split("/").pop() || "Файл";
                      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(
                        path,
                      );
                      return (
                        <a
                          key={idx}
                          href={path}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          {isImage ? "🖼️" : "📎"} {filename.substring(0, 20)}
                          {filename.length > 20 ? "..." : ""}
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Форма добавления комментария */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Добавить комментарий..."
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          rows={3}
          disabled={submitting}
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Отправка..." : "Отправить"}
          </button>
        </div>
      </form>

      {/* Модальное окно для email-ответа */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Ответить по email
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Получатель: {recipientEmail}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailError(null);
                  setEmailSuccess(null);
                }}
                className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              {emailError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg text-sm">
                  {emailError}
                </div>
              )}

              {emailSuccess && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg text-sm">
                  {emailSuccess}
                </div>
              )}

              <textarea
                value={emailReplyContent}
                onChange={(e) => setEmailReplyContent(e.target.value)}
                placeholder="Введите текст ответа..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={6}
                disabled={sendingEmail}
              />

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Ваш ответ будет отправлен на email и добавлен как комментарий к
                заявке. Пользователь сможет ответить на письмо, и его ответ
                автоматически добавится к заявке.
              </p>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailError(null);
                  setEmailSuccess(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                disabled={sendingEmail}
              >
                Отмена
              </button>
              <button
                onClick={handleSendEmailReply}
                disabled={!emailReplyContent.trim() || sendingEmail}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Mail className="h-4 w-4 mr-2" />
                {sendingEmail ? "Отправка..." : "Отправить"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
