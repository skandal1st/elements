import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Building2 } from 'lucide-react';
import { buildingsService } from '../services/buildings.service';
import type { Building } from '../types';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { BuildingForm } from '../components/buildings/BuildingForm';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { useAuthStore } from '../store/auth.store';
import { canManageEquipment } from '../utils/permissions';

export const BuildingsPage = () => {
  const { user } = useAuthStore();
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageEquipment(user?.role);

  const loadBuildings = async () => {
    setLoading(true);
    setError(null);
    try {
      // Для админов загружаем все здания, для остальных - только активные
      const result = await buildingsService.getBuildings(user?.role !== 'admin');
      if (result.error) {
        console.error('Ошибка загрузки зданий:', result.error);
        setError(result.error.message || 'Ошибка при загрузке зданий');
      } else {
        setBuildings(result.data);
      }
    } catch (err) {
      console.error('Исключение при загрузке:', err);
      setError('Произошла ошибка при загрузке зданий');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuildings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = () => {
    setEditingBuilding(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (item: Building) => {
    setEditingBuilding(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить это здание?')) return;
    
    const { error } = await buildingsService.deleteBuilding(id);
    if (error) {
      alert('Ошибка при удалении: ' + error.message);
    } else {
      loadBuildings();
    }
  };

  const handleSubmit = async (data: any) => {
    if (editingBuilding) {
      const { error } = await buildingsService.updateBuilding(editingBuilding.id, data);
      if (error) {
        alert('Ошибка при обновлении: ' + error.message);
        return;
      }
    } else {
      const { error } = await buildingsService.createBuilding(data);
      if (error) {
        alert('Ошибка при создании: ' + error.message);
        return;
      }
    }
    setIsModalOpen(false);
    setEditingBuilding(undefined);
    loadBuildings();
  };

  const filteredBuildings = buildings.filter((building) =>
    building.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (building.address && building.address.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Building2 className="h-8 w-8 mr-3" />
            Здания
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Управление зданиями организации
          </p>
        </div>
        {canManage && (
          <Button onClick={handleCreate}>
            <Plus className="h-5 w-5 mr-2" />
            Добавить здание
          </Button>
        )}
      </div>

      {/* Поиск */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию или адресу..."
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
      ) : filteredBuildings.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
          {searchTerm ? 'Здания не найдены' : 'Здания не добавлены'}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableHeaderCell>Название</TableHeaderCell>
              <TableHeaderCell>Адрес</TableHeaderCell>
              <TableHeaderCell>Описание</TableHeaderCell>
              <TableHeaderCell>Статус</TableHeaderCell>
              {canManage && <TableHeaderCell>Действия</TableHeaderCell>}
            </TableHeader>
            <TableBody>
              {filteredBuildings.map((building) => (
                <TableRow key={building.id}>
                  <TableCell>
                    <div className="font-medium">{building.name}</div>
                  </TableCell>
                  <TableCell>
                    {building.address || <span className="text-gray-400">-</span>}
                  </TableCell>
                  <TableCell>
                    {building.description ? (
                      <div className="max-w-md truncate" title={building.description}>
                        {building.description}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        building.is_active
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {building.is_active ? 'Активно' : 'Неактивно'}
                    </span>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(building)}
                          className="p-2 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {user?.role === 'admin' && (
                          <button
                            onClick={() => handleDelete(building.id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Модальное окно для создания/редактирования */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingBuilding(undefined);
        }}
        title={editingBuilding ? 'Редактировать здание' : 'Добавить здание'}
      >
        <BuildingForm
          building={editingBuilding}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingBuilding(undefined);
          }}
        />
      </Modal>
    </div>
  );
};




