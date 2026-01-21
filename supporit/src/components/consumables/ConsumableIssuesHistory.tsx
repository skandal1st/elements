import { useState, useEffect } from 'react';
import { History } from 'lucide-react';
import { consumablesService } from '../../services/consumables.service';
import type { ConsumableIssue } from '../../types';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '../ui/Table';
import { formatDateTime } from '../../utils/format';

interface ConsumableIssuesHistoryProps {
  consumableId?: string;
}

export const ConsumableIssuesHistory = ({ consumableId }: ConsumableIssuesHistoryProps) => {
  const [issues, setIssues] = useState<ConsumableIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [error, setError] = useState<string | null>(null);

  const loadIssues = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await consumablesService.getConsumableIssues({
        consumable_id: consumableId,
        page,
        pageSize,
      });
      if (result.error) {
        console.error('Ошибка загрузки истории выдачи:', result.error);
        setError(result.error.message || 'Ошибка при загрузке истории выдачи');
      } else {
        setIssues(result.data);
        setTotalCount(result.count);
      }
    } catch (err) {
      console.error('Исключение при загрузке:', err);
      setError('Произошла ошибка при загрузке истории выдачи');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, consumableId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <History className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            История выдачи расходников
          </h2>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : issues.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            История выдачи пуста
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <Table>
              <TableHeader>
                <TableHeaderCell>Дата</TableHeaderCell>
                <TableHeaderCell>Расходник</TableHeaderCell>
                <TableHeaderCell>Количество</TableHeaderCell>
                <TableHeaderCell>Выдан</TableHeaderCell>
                <TableHeaderCell>Выдал</TableHeaderCell>
                <TableHeaderCell>Причина</TableHeaderCell>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell>
                      {formatDateTime(issue.created_at)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{issue.consumable?.name || '-'}</div>
                        {issue.consumable?.model && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {issue.consumable.model}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {issue.quantity} {issue.consumable?.unit || 'шт'}
                    </TableCell>
                    <TableCell>
                      {issue.issued_to?.full_name || '-'}
                      {issue.issued_to?.email && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {issue.issued_to.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {issue.issued_by?.full_name || '-'}
                      {issue.issued_by?.email && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {issue.issued_by.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {issue.reason || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Пагинация */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Показано {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} из {totalCount}
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Назад
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * pageSize >= totalCount}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Вперед
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
