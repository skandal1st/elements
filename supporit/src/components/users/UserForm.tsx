import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import type { User, UserRole } from '../../types';
import { Button } from '../ui/Button';

const createUserSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().optional().refine(
    (val) => {
      // Пароль опционален - может быть пустым или undefined
      if (!val || val.trim() === '') {
        return true;
      }
      // Если пароль указан, он должен быть минимум 6 символов
      return val.length >= 6;
    },
    { message: 'Пароль должен содержать минимум 6 символов' }
  ),
  full_name: z.string().min(1, 'Имя обязательно'),
  role: z.enum(['admin', 'it_specialist', 'employee']),
  department: z.string().optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
});

const updateUserSchema = z.object({
  full_name: z.string().min(1, 'Имя обязательно'),
  role: z.enum(['admin', 'it_specialist', 'employee']),
  department: z.string().optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type UpdateUserFormData = z.infer<typeof updateUserSchema>;
type UserFormData = CreateUserFormData | UpdateUserFormData;

interface UserFormProps {
  user?: User;
  onSubmit: (data: UserFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Администратор',
  it_specialist: 'ИТ-специалист',
  employee: 'Сотрудник',
};

export const UserForm = ({ user, onSubmit, onCancel, loading }: UserFormProps) => {
  const isCreating = !user;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UserFormData>({
    resolver: zodResolver(isCreating ? createUserSchema : updateUserSchema),
    defaultValues: user
      ? {
          full_name: user.full_name,
          role: user.role,
          department: user.department || '',
          position: user.position || '',
          phone: user.phone || '',
        }
      : {
          role: 'employee',
        },
  });

  useEffect(() => {
    if (user) {
      reset({
        full_name: user.full_name,
        role: user.role,
        department: user.department || '',
        position: user.position || '',
        phone: user.phone || '',
      });
    }
  }, [user, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isCreating ? (
          <>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                {...register('email')}
                type="email"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="user@example.com"
              />
              {(errors as any).email && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{(errors as any).email.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Пароль (опционально)
              </label>
              <input
                {...register('password')}
                type="password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Оставьте пустым, чтобы пользователь установил пароль при первом входе"
              />
              {(errors as any).password && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{(errors as any).password.message}</p>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Если пароль не указан, пользователь сможет установить его при первом входе в систему
              </p>
            </div>
          </>
        ) : (
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email
            </label>
            <input
              type="text"
              value={user.email}
              disabled
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Email нельзя изменить
            </p>
          </div>
        )}

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Полное имя <span className="text-red-500">*</span>
          </label>
          <input
            {...register('full_name')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Иванов Иван Иванович"
          />
          {errors.full_name && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.full_name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Роль <span className="text-red-500">*</span>
          </label>
          <select
            {...register('role')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="employee">{roleLabels.employee}</option>
            <option value="it_specialist">{roleLabels.it_specialist}</option>
            <option value="admin">{roleLabels.admin}</option>
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Администратор имеет полный доступ ко всем функциям
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Отдел
          </label>
          <input
            {...register('department')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: Отдел продаж"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Должность
          </label>
          <input
            {...register('position')}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="Например: Менеджер"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Телефон
          </label>
          <input
            {...register('phone')}
            type="tel"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="+7 (999) 123-45-67"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Отмена
        </Button>
        <Button type="submit" loading={loading}>
          {isCreating ? 'Создать' : 'Сохранить'}
        </Button>
      </div>
    </form>
  );
};


