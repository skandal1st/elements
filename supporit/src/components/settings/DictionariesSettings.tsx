import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, List, CheckCircle, XCircle, Lock } from 'lucide-react';
import { dictionariesService } from '../../services/dictionaries.service';
import type { Dictionary, DictionaryType } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '../ui/Table';

const dictionaryTypeLabels: Record<DictionaryType, string> = {
  equipment_category: 'Категории оборудования',
  equipment_status: 'Статусы оборудования',
  ticket_category: 'Категории заявок',
  ticket_priority: 'Приоритеты заявок',
  ticket_status: 'Статусы заявок',
  consumable_type: 'Типы расходников',
};

interface DictionariesSettingsProps {
  type: DictionaryType;
}

export const DictionariesSettings = ({ type }: DictionariesSettingsProps) => {
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDictionary, setEditingDictionary] = useState<Dictionary | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Форма
  const [formData, setFormData] = useState({
    key: '',
    label: '',
    color: '',
    sort_order: 0,
    is_active: true,
  });

  const loadDictionaries = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dictionariesService.getDictionaries(type);
      if (result.error) {
        setError(result.error.message);
      } else {
        setDictionaries(result.data);
      }
    } catch (err) {
      setError('Произошла ошибка при загрузке справочника');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDictionaries();
  }, [type]);

  const handleCreate = () => {
    setEditingDictionary(null);
    setFormData({ key: '', label: '', color: '', sort_order: 0, is_active: true });
    setIsModalOpen(true);
  };

  const handleEdit = (dictionary: Dictionary) => {
    setEditingDictionary(dictionary);
    setFormData({
      key: dictionary.key,
      label: dictionary.label,
      color: dictionary.color || '',
      sort_order: dictionary.sort_order,
      is_active: dictionary.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      if (editingDictionary) {
        const result = await dictionariesService.updateDictionary(editingDictionary.id, {
          label: formData.label,
          color: formData.color || undefined,
          sort_order: formData.sort_order,
          is_active: formData.is_active,
        });
        if (result.error) {
          setError(result.error.message);
          return;
        }
      } else {
        const result = await dictionariesService.createDictionary({
          dictionary_type: type,
          key: formData.key,
          label: formData.label,
          color: formData.color || undefined,
          sort_order: formData.sort_order,
          is_active: formData.is_active,
        });
        if (result.error) {
          setError(result.error.message);
          return;
        }
      }

      setIsModalOpen(false);
      loadDictionaries();
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (dictionary: Dictionary) => {
    if (dictionary.is_system) {
      alert('Системные элементы нельзя удалить. Деактивируйте элемент вместо удаления.');
      return;
    }

    if (!confirm(`Вы уверены, что хотите удалить элемент "${dictionary.label}"?`)) {
      return;
    }

    const result = await dictionariesService.deleteDictionary(dictionary.id);
    if (result.error) {
      setError(result.error.message);
    } else {
      loadDictionaries();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <List className="h-6 w-6 mr-2" />
            {dictionaryTypeLabels[type]}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Управление справочником
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-5 w-5 mr-2" />
          Добавить элемент
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : dictionaries.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
          Элементы не найдены
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableHeaderCell>Ключ</TableHeaderCell>
              <TableHeaderCell>Название</TableHeaderCell>
              <TableHeaderCell>Цвет</TableHeaderCell>
              <TableHeaderCell>Порядок</TableHeaderCell>
              <TableHeaderCell>Статус</TableHeaderCell>
              <TableHeaderCell>Действия</TableHeaderCell>
            </TableHeader>
            <TableBody>
              {dictionaries.map((dictionary) => (
                <TableRow key={dictionary.id}>
                  <TableCell>
                    <div className="flex items-center">
                      {dictionary.is_system && (
                        <span title="Системный элемент">
                          <Lock className="h-4 w-4 mr-1 text-gray-400" />
                        </span>
                      )}
                      <code className="text-sm">{dictionary.key}</code>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{dictionary.label}</div>
                  </TableCell>
                  <TableCell>
                    {dictionary.color ? (
                      <div className="flex items-center">
                        <div
                          className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 mr-2"
                          style={{ backgroundColor: dictionary.color }}
                        />
                        <code className="text-sm">{dictionary.color}</code>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>{dictionary.sort_order}</TableCell>
                  <TableCell>
                    {dictionary.is_active ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Активно
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        <XCircle className="h-3 w-3 mr-1" />
                        Неактивно
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(dictionary)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {!dictionary.is_system && (
                        <button
                          onClick={() => handleDelete(dictionary)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDictionary ? `Редактировать: ${editingDictionary.label}` : 'Добавить элемент'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editingDictionary && (
            <div>
              <label htmlFor="key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ключ <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-1">(латиница и подчеркивание)</span>
              </label>
              <input
                id="key"
                type="text"
                required
                pattern="[a-z_]+"
                value={formData.key}
                onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase() })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={!!editingDictionary}
              />
            </div>
          )}

          <div>
            <label htmlFor="label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Название <span className="text-red-500">*</span>
            </label>
            <input
              id="label"
              type="text"
              required
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="color" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Цвет
            </label>
            <input
              id="color"
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-full h-10 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="sort_order" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Порядок сортировки
            </label>
            <input
              id="sort_order"
              type="number"
              min="0"
              value={formData.sort_order}
              onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={editingDictionary?.is_system}
            />
          </div>

          <div className="flex items-center">
            <input
              id="is_active"
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              disabled={editingDictionary?.is_system}
            />
            <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Активно
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" onClick={() => setIsModalOpen(false)} variant="secondary">
              Отмена
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingDictionary ? 'Сохранить' : 'Создать'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
