import { useState, useEffect } from 'react';
import { Plus, Search, Edit, Key, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { licensesService, type LicenseFilters } from '../services/licenses.service';
import type { SoftwareLicense } from '../types';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Table, TableHeader, TableHeaderCell, TableBody, TableRow, TableCell } from '../components/ui/Table';
import { LicenseForm } from '../components/licenses/LicenseForm';
import { LicenseDetailsModal } from '../components/licenses/LicenseDetailsModal';

export const LicensesPage = () => {
  const [licenses, setLicenses] = useState<SoftwareLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLicense, setEditingLicense] = useState<SoftwareLicense | undefined>();
  const [viewingLicenseId, setViewingLicenseId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<LicenseFilters>({});
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const loadLicenses = async () => {
    setLoading(true);
    try {
      const result = await licensesService.getLicenses(
        {
          ...filters,
          search: searchTerm || undefined,
        },
        page,
        pageSize
      );
      if (!result.error) {
        setLicenses(result.data);
        setTotalCount(result.count);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLicenses();
  }, [page, filters, searchTerm]);

  const handleCreate = () => {
    setEditingLicense(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (license: SoftwareLicense) => {
    setEditingLicense(license);
    setIsModalOpen(true);
  };

  const handleView = (license: SoftwareLicense) => {
    setViewingLicenseId(license.id);
  };

  const handleSubmit = async (data: any) => {
    if (editingLicense) {
      const { error } = await licensesService.updateLicense(editingLicense.id, data);
      if (error) {
        alert('Ошибка при обновлении: ' + error.message);
        return;
      }
    } else {
      const { error } = await licensesService.createLicense(data);
      if (error) {
        alert('Ошибка при создании: ' + error.message);
        return;
      }
    }
    setIsModalOpen(false);
    setEditingLicense(undefined);
    loadLicenses();
  };

  const toggleKeyVisibility = (licenseId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(licenseId)) {
        newSet.delete(licenseId);
      } else {
        newSet.add(licenseId);
      }
      return newSet;
    });
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Лицензии ПО</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Всего: {totalCount} лицензий
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-5 w-5 mr-2" />
          Добавить лицензию
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Поиск по названию или поставщику..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={filters.expired === undefined ? 'all' : filters.expired ? 'true' : 'false'}
              onChange={(e) => {
                const value = e.target.value;
                setFilters(prev => ({
                  ...prev,
                  expired: value === 'all' ? undefined : value === 'true',
                }));
                setPage(1);
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="all">Все</option>
              <option value="false">Активные</option>
              <option value="true">Истекшие</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : licenses.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Лицензии не найдены
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableHeaderCell>ПО</TableHeaderCell>
              <TableHeaderCell>Поставщик</TableHeaderCell>
              <TableHeaderCell>Тип</TableHeaderCell>
              <TableHeaderCell>Лицензионный ключ</TableHeaderCell>
              <TableHeaderCell>Использовано</TableHeaderCell>
              <TableHeaderCell>Срок действия</TableHeaderCell>
              <TableHeaderCell>Стоимость</TableHeaderCell>
              <TableHeaderCell>Действия</TableHeaderCell>
            </TableHeader>
            <TableBody>
              {licenses.map((license) => (
                <TableRow key={license.id}>
                  <TableCell className="font-medium">{license.software_name}</TableCell>
                  <TableCell>{license.vendor || '-'}</TableCell>
                  <TableCell>{license.license_type || '-'}</TableCell>
                  <TableCell>
                    {license.license_key ? (
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                          {visibleKeys.has(license.id) ? license.license_key : '••••••••'}
                        </code>
                        <button
                          onClick={() => toggleKeyVisibility(license.id)}
                          className="p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                          title={visibleKeys.has(license.id) ? 'Скрыть' : 'Показать'}
                        >
                          {visibleKeys.has(license.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span className={license.used_licenses >= license.total_licenses ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                        {license.used_licenses} / {license.total_licenses}
                      </span>
                      {license.used_licenses >= license.total_licenses && (
                        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {license.expires_at ? (
                      <span className={isExpired(license.expires_at) ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                        {new Date(license.expires_at).toLocaleDateString('ru-RU')}
                        {isExpired(license.expires_at) && ' (истек)'}
                      </span>
                    ) : (
                      <span className="text-gray-400">Бессрочно</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {license.cost ? `${license.cost.toLocaleString('ru-RU')} ₽` : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleView(license)}
                        className="p-1 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                        title="Просмотр"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(license)}
                        className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Редактировать"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Страница {page} из {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Назад
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Вперед
            </Button>
          </div>
        </div>
      )}

      {/* Модальное окно формы */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingLicense(undefined);
        }}
        title={editingLicense ? 'Редактировать лицензию' : 'Новая лицензия'}
      >
        <LicenseForm
          license={editingLicense}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingLicense(undefined);
          }}
        />
      </Modal>

      {/* Модальное окно просмотра */}
      {viewingLicenseId && (
        <LicenseDetailsModal
          licenseId={viewingLicenseId}
          isOpen={!!viewingLicenseId}
          onClose={() => setViewingLicenseId(null)}
          onUpdate={loadLicenses}
        />
      )}
    </div>
  );
};
