import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Home } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';

export const UnauthorizedPage = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Если сотрудник попал на страницу "доступ запрещен", перенаправляем на заявки
  useEffect(() => {
    if (user?.role === 'employee') {
      navigate('/tickets', { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-full">
            <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Доступ запрещен
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          У вас нет прав для доступа к этой странице
        </p>
        <button
          onClick={() => navigate(user?.role === 'employee' ? '/tickets' : '/dashboard')}
          className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
        >
          <Home className="h-5 w-5 mr-2" />
          На главную
        </button>
      </div>
    </div>
  );
};



