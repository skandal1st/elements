import { useState } from 'react';
import type { SoftwareLicense } from '../../types';
import { Button } from '../ui/Button';

interface LicenseFormProps {
  license?: SoftwareLicense;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}

export const LicenseForm = ({ license, onSubmit, onCancel }: LicenseFormProps) => {
  const [formData, setFormData] = useState({
    software_name: license?.software_name || '',
    vendor: license?.vendor || '',
    license_type: license?.license_type || '',
    license_key: license?.license_key || '',
    total_licenses: license?.total_licenses || 1,
    expires_at: license?.expires_at ? license.expires_at.split('T')[0] : '',
    cost: license?.cost || '',
    purchase_date: license?.purchase_date ? license.purchase_date.split('T')[0] : '',
    notes: license?.notes || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      ...formData,
      cost: formData.cost ? parseFloat(formData.cost.toString()) : null,
      total_licenses: parseInt(formData.total_licenses.toString()),
      expires_at: formData.expires_at || null,
      purchase_date: formData.purchase_date || null,
    };

    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Название ПО */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Название ПО <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={formData.software_name}
          onChange={(e) => setFormData({ ...formData, software_name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Поставщик */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Поставщик
        </label>
        <input
          type="text"
          value={formData.vendor}
          onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Тип лицензии */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Тип лицензии
        </label>
        <input
          type="text"
          value={formData.license_type}
          onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
          placeholder="Например: Perpetual, Subscription, OEM"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Лицензионный ключ */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Лицензионный ключ
        </label>
        <textarea
          value={formData.license_key}
          onChange={(e) => setFormData({ ...formData, license_key: e.target.value })}
          rows={2}
          placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
        />
      </div>

      {/* Количество лицензий */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Количество лицензий <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          required
          min="1"
          value={formData.total_licenses}
          onChange={(e) => setFormData({ ...formData, total_licenses: parseInt(e.target.value) || 1 })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Дата покупки и срок действия */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Дата покупки
          </label>
          <input
            type="date"
            value={formData.purchase_date}
            onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Срок действия
          </label>
          <input
            type="date"
            value={formData.expires_at}
            onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Стоимость */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Стоимость (₽)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={formData.cost}
          onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Примечания */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Примечания
        </label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Кнопки */}
      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit">
          {license ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </form>
  );
};
