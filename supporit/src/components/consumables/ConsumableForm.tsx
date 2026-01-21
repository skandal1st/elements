import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import type { Consumable } from '../../types';
import { Button } from '../ui/Button';

const consumableSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  model: z.string().optional(),
  category: z.string().optional(),
  consumable_type: z.string().optional(),
  unit: z.string().min(1, 'Единица измерения обязательна'),
  quantity_in_stock: z.number().min(0, 'Количество не может быть отрицательным'),
  min_quantity: z.number().min(0, 'Минимальное количество не может быть отрицательным'),
  cost_per_unit: z.number().optional().nullable(),
  supplier: z.string().optional(),
  last_purchase_date: z.string().optional(),
});

type ConsumableFormData = z.infer<typeof consumableSchema>;

interface ConsumableFormProps {
  consumable?: Consumable;
  onSubmit: (data: ConsumableFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const ConsumableForm = ({ consumable, onSubmit, onCancel, loading }: ConsumableFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ConsumableFormData>({
    resolver: zodResolver(consumableSchema),
    defaultValues: consumable
      ? {
          name: consumable.name,
          model: consumable.model || '',
          category: consumable.category || '',
          consumable_type: (consumable as any).consumable_type || '',
          unit: consumable.unit,
          quantity_in_stock: consumable.quantity_in_stock,
          min_quantity: consumable.min_quantity,
          cost_per_unit: consumable.cost_per_unit || null,
          supplier: consumable.supplier || '',
          last_purchase_date: consumable.last_purchase_date ? new Date(consumable.last_purchase_date).toISOString().split('T')[0] : '',
        }
      : {
          unit: 'шт',
          quantity_in_stock: 0,
          min_quantity: 0,
        },
  });

  useEffect(() => {
    if (consumable) {
      reset({
        name: consumable.name,
        model: consumable.model || '',
        category: consumable.category || '',
        consumable_type: (consumable as any).consumable_type || '',
        unit: consumable.unit,
        quantity_in_stock: consumable.quantity_in_stock,
        min_quantity: consumable.min_quantity,
        cost_per_unit: consumable.cost_per_unit || null,
        supplier: consumable.supplier || '',
        last_purchase_date: consumable.last_purchase_date ? new Date(consumable.last_purchase_date).toISOString().split('T')[0] : '',
      });
    }
  }, [consumable, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Название <span className="text-red-500">*</span>
          </label>
          <input
            {...register('name')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: Картридж HP 85A"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Модель
          </label>
          <input
            {...register('model')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: HP 85A"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Категория
          </label>
          <input
            {...register('category')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: printer_cartridge"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Тип расходника
          </label>
          <select
            {...register('consumable_type')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">Не указан</option>
            <option value="cartridge">Картридж</option>
            <option value="drum">Фотобарабан</option>
            <option value="toner">Тонер</option>
            <option value="ink">Чернила</option>
            <option value="paper">Бумага</option>
            <option value="other">Прочее</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Единица измерения <span className="text-red-500">*</span>
          </label>
          <select
            {...register('unit')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="шт">шт</option>
            <option value="упак">упак</option>
            <option value="л">л</option>
            <option value="кг">кг</option>
            <option value="м">м</option>
          </select>
          {errors.unit && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.unit.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            В наличии <span className="text-red-500">*</span>
          </label>
          <input
            {...register('quantity_in_stock', { valueAsNumber: true })}
            type="number"
            min="0"
            step="1"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {errors.quantity_in_stock && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.quantity_in_stock.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Минимальное количество <span className="text-red-500">*</span>
          </label>
          <input
            {...register('min_quantity', { valueAsNumber: true })}
            type="number"
            min="0"
            step="1"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          {errors.min_quantity && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.min_quantity.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Стоимость за единицу
          </label>
          <input
            {...register('cost_per_unit', { valueAsNumber: true })}
            type="number"
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Поставщик
          </label>
          <input
            {...register('supplier')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Название поставщика"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Дата последней покупки
          </label>
          <input
            {...register('last_purchase_date')}
            type="date"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Отмена
        </Button>
        <Button type="submit" loading={loading}>
          {consumable ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </form>
  );
};



