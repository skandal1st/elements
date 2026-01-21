import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, History } from 'lucide-react';
import { consumablesService } from '../services/consumables.service';
import type { Consumable } from '../types';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConsumableForm } from '../components/consumables/ConsumableForm';
import { ConsumableIssuesHistory } from '../components/consumables/ConsumableIssuesHistory';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { formatCurrency } from '../utils/format';
import { useAuthStore } from '../store/auth.store';
import { canManageEquipment } from '../utils/permissions';

export const ConsumablesPage = () => {
  const { user } = useAuthStore();
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConsumable, setEditingConsumable] = useState<Consumable | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'history'>('list');

  const [error, setError] = useState<string | null>(null);
  const canManage = canManageEquipment(user?.role);

  const loadConsumables = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await consumablesService.getConsumables({
        search: searchTerm || undefined,
        page,
        pageSize,
      });
      if (result.error) {
        console.error('Ошибка загрузки расходников:', result.error);
        setError(result.error.message || 'Ошибка при загрузке расходников');
      } else {
        setConsumables(result.data);
        setTotalCount(result.count);
      }
    } catch (err) {
      console.error('Исключение при загрузке:', err);
      setError('Произошла ошибка при загрузке расходников');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConsumables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchTerm]);

  const handleCreate = () => {
    setEditingConsumable(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (item: Consumable) => {
    setEditingConsumable(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот расходник?')) return;
    
    const { error } = await consumablesService.deleteConsumable(id);
    if (error) {
      alert('Ошибка при удалении: ' + error.message);
    } else {
      loadConsumables();
    }
  };

  const handleSubmit = async (data: any) => {
    if (editingConsumable) {
      const { error } = await consumablesService.updateConsumable(editingConsumable.id, data);
      if (error) {
        alert('Ошибка при обновлении: ' + error.message);
        return;
      }
    } else {
      const { error } = await consumablesService.createConsumable(data);
      if (error) {
        alert('Ошибка при создании: ' + error.message);
        return;
      }
    }
    setIsModalOpen(false);
    setEditingConsumable(undefined);
    loadConsumables();
  };

  const getStockStatus = (quantity: number, minQuantity: number) => {
    if (quantity <= minQuantity) {
      return { label: 'Низкий остаток', color: 'text-yellow-600 dark:text-yellow-400' };
    }
    if (quantity === 0) {
      return { label: 'Нет в наличии', color: 'text-red-600 dark:text-red-400' };
    }
    return { label: 'В наличии', color: 'text-green-600 dark:text-green-400' };
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Package className="h-8 w-8 mr-3" />
            Расходные материалы
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Управление расходными материалами и их количеством
          </p>
        </div>
        {canManage && activeTab === 'list' && (
          <Button onClick={handleCreate}>
            <Plus className="h-5 w-5 mr-2" />
            Добавить расходник
          </Button>
        )}
      </div>

      {/* Вкладки */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('list')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'list'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Список расходников</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'history'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <History className="h-5 w-5" />
              <span>История выдачи</span>
            </div>
          </button>
        </nav>
      </div>

      {activeTab === 'history' ? (
        <ConsumableIssuesHistory />
      ) : (
        <>
          {/* Поиск */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по названию или модели..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Таблица */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : consumables.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                {searchTerm ? 'Расходники не найдены' : 'Нет расходников. Добавьте первый расходник.'}
              </p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableHeaderCell>Название</TableHeaderCell>
                    <TableHeaderCell>Модель</TableHeaderCell>
                    <TableHeaderCell>Категория</TableHeaderCell>
                    <TableHeaderCell>Единица</TableHeaderCell>
                    <TableHeaderCell>В наличии</TableHeaderCell>
                    <TableHeaderCell>Мин. количество</TableHeaderCell>
                    <TableHeaderCell>Статус</TableHeaderCell>
                    <TableHeaderCell>Стоимость</TableHeaderCell>
                    {canManage && <TableHeaderCell>Действия</TableHeaderCell>}
                  </TableHeader>
                  <TableBody>
                    {consumables.map((consumable) => {
                      const stockStatus = getStockStatus(consumable.quantity_in_stock, consumable.min_quantity);
                      return (
                        <TableRow key={consumable.id}>
                          <TableCell className="font-medium">{consumable.name}</TableCell>
                          <TableCell>{consumable.model || '-'}</TableCell>
                          <TableCell>{consumable.category || '-'}</TableCell>
                          <TableCell>{consumable.unit}</TableCell>
                          <TableCell className="font-medium">{consumable.quantity_in_stock}</TableCell>
                          <TableCell>{consumable.min_quantity}</TableCell>
                          <TableCell>
                            <span className={stockStatus.color}>{stockStatus.label}</span>
                          </TableCell>
                          <TableCell>
                            {consumable.cost_per_unit ? formatCurrency(consumable.cost_per_unit) : '-'}
                          </TableCell>
                          {canManage && (
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleEdit(consumable)}
                                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                  title="Редактировать"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(consumable.id)}
                                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Удалить"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Пагинация */}
              {totalCount > pageSize && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Показано {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, totalCount)} из {totalCount}
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      variant="secondary"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Назад
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * pageSize >= totalCount}
                    >
                      Вперед
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Модальное окно формы */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingConsumable(undefined);
        }}
        title={editingConsumable ? 'Редактировать расходник' : 'Добавить расходник'}
      >
        <ConsumableForm
          consumable={editingConsumable}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingConsumable(undefined);
          }}
        />
      </Modal>
    </div>
  );
};

