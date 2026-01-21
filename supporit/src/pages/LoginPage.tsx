import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { LoginForm } from '../components/auth/LoginForm';
import { Monitor } from 'lucide-react';

export const LoginPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user) {
      // Перенаправляем в зависимости от роли
      const targetPath = user.role === 'employee' ? '/tickets' : '/dashboard';
      navigate(targetPath, { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="bg-primary-600 p-3 rounded-full">
              <Monitor className="h-10 w-10 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            ИТ-Поддержка
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Система учета ИТ-оборудования
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-8">
          <LoginForm onSuccess={() => {}} />
        </div>
      </div>
    </div>
  );
};



