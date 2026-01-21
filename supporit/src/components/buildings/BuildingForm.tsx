import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import type { Building } from '../../types';
import { Button } from '../ui/Button';

const buildingSchema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  address: z.string().optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
});

type BuildingFormData = z.infer<typeof buildingSchema>;

interface BuildingFormProps {
  building?: Building;
  onSubmit: (data: BuildingFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const BuildingForm = ({ building, onSubmit, onCancel, loading }: BuildingFormProps) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BuildingFormData>({
    resolver: zodResolver(buildingSchema),
    defaultValues: building
      ? {
          name: building.name,
          address: building.address || '',
          description: building.description || '',
          is_active: building.is_active ?? true,
        }
      : {
          is_active: true,
        },
  });

  useEffect(() => {
    if (building) {
      reset({
        name: building.name,
        address: building.address || '',
        description: building.description || '',
        is_active: building.is_active ?? true,
      });
    }
  }, [building, reset]);

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
            placeholder="Например: Здание А"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
          )}
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Адрес
          </label>
          <input
            {...register('address')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: ул. Ленина, д. 1"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Описание
          </label>
          <textarea
            {...register('description')}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Дополнительная информация о здании"
          />
        </div>

        {building && (
          <div className="md:col-span-2">
            <label className="flex items-center">
              <input
                {...register('is_active')}
                type="checkbox"
                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 dark:bg-gray-800"
              />
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Активно</span>
            </label>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Отмена
        </Button>
        <Button type="submit" loading={loading}>
          {building ? 'Сохранить' : 'Создать'}
        </Button>
      </div>
    </form>
  );
};




