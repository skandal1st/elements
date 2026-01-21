import { useEffect, useState } from 'react';
import { Calendar, User, AlertCircle, Tag, MapPin, Clock } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { TicketComments } from './TicketComments';
import { ticketsService } from '../../services/tickets.service';
import type { Ticket, TicketStatus, TicketPriority } from '../../types';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TicketDetailsModalProps {
  ticketId: string;
  isOpen: boolean;
  onClose: () => void;
}

const getStatusLabel = (status: TicketStatus): string => {
  const labels: Record<TicketStatus, string> = {
    new: 'Новая',
    in_progress: 'В работе',
    waiting: 'Ожидание',
    resolved: 'Решена',
    closed: 'Закрыта',
    pending_user: 'Требует пользователя',
  };
  return labels[status] || status;
};

const getStatusColor = (status: TicketStatus): string => {
  const colors: Record<TicketStatus, string> = {
    new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    waiting: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    closed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    pending_user: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  };
  return colors[status] || '';
};

const getPriorityLabel = (priority: TicketPriority): string => {
  const labels: Record<TicketPriority, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    critical: 'Критический',
  };
  return labels[priority] || priority;
};

const getPriorityColor = (priority: TicketPriority): string => {
  const colors: Record<TicketPriority, string> = {
    low: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return colors[priority] || '';
};

export const TicketDetailsModal = ({ ticketId, isOpen, onClose }: TicketDetailsModalProps) => {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && ticketId) {
      loadTicket();
    }
  }, [ticketId, isOpen]);

  const loadTicket = async () => {
    setLoading(true);
    try {
      const result = await ticketsService.getTicketById(ticketId);
      if (!result.error && result.data) {
        setTicket(result.data);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ticket?.title || 'Загрузка...'}
      size="xl"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : ticket ? (
        <div className="space-y-6">
          {/* Основная информация */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Статус */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Статус
              </label>
              <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(ticket.status)}`}>
                {getStatusLabel(ticket.status)}
              </span>
            </div>

            {/* Приоритет */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Приоритет
              </label>
              <span className={`inline-flex items-center px-3 py-1 text-sm font-medium rounded-full ${getPriorityColor(ticket.priority)}`}>
                <AlertCircle className="h-4 w-4 mr-1" />
                {getPriorityLabel(ticket.priority)}
              </span>
            </div>

            {/* Создатель */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <User className="h-4 w-4 inline mr-1" />
                Создатель
              </label>
              <p className="text-sm text-gray-900 dark:text-white">
                {ticket.creator?.full_name || 'Неизвестно'}
              </p>
              {ticket.creator?.department && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {ticket.creator.department}
                </p>
              )}
            </div>

            {/* Исполнитель */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <User className="h-4 w-4 inline mr-1" />
                Исполнитель
              </label>
              <p className="text-sm text-gray-900 dark:text-white">
                {ticket.assignee?.full_name || 'Не назначен'}
              </p>
              {ticket.assignee?.department && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {ticket.assignee.department}
                </p>
              )}
            </div>

            {/* Категория */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Tag className="h-4 w-4 inline mr-1" />
                Категория
              </label>
              <p className="text-sm text-gray-900 dark:text-white">{ticket.category}</p>
            </div>

            {/* Местоположение */}
            {(ticket.location_department || ticket.location_room) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="h-4 w-4 inline mr-1" />
                  Местоположение
                </label>
                <p className="text-sm text-gray-900 dark:text-white">
                  {ticket.location_department && `${ticket.location_department}`}
                  {ticket.location_room && `, кабинет ${ticket.location_room}`}
                </p>
              </div>
            )}

            {/* Создано */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Calendar className="h-4 w-4 inline mr-1" />
                Создано
              </label>
              <p className="text-sm text-gray-900 dark:text-white">
                {formatDistanceToNow(new Date(ticket.created_at), {
                  addSuffix: true,
                  locale: ru,
                })}
              </p>
            </div>

            {/* Обновлено */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Clock className="h-4 w-4 inline mr-1" />
                Обновлено
              </label>
              <p className="text-sm text-gray-900 dark:text-white">
                {formatDistanceToNow(new Date(ticket.updated_at), {
                  addSuffix: true,
                  locale: ru,
                })}
              </p>
            </div>
          </div>

          {/* Описание */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Описание
            </label>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                {ticket.description}
              </p>
            </div>
          </div>

          {/* Оборудование */}
          {ticket.equipment && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Оборудование
              </label>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {ticket.equipment.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {ticket.equipment.model} • {ticket.equipment.inventory_number}
                </p>
              </div>
            </div>
          )}

          {/* Разделитель */}
          <div className="border-t border-gray-200 dark:border-gray-700"></div>

          {/* Комментарии */}
          <TicketComments ticketId={ticketId} />
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Заявка не найдена</p>
        </div>
      )}
    </Modal>
  );
};
