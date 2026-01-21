import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { login } from "../api/client";

type LoginButtonProps = {
  isAuthed: boolean;
  onLogin: () => void;
  onLogout: () => void;
};

export function LoginButton({ isAuthed, onLogin, onLogout }: LoginButtonProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleLogin = async () => {
    try {
      await login(username, password);
      setError(null);
      setIsOpen(false);
      setUsername("");
      setPassword("");
      onLogin();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleLogout = () => {
    onLogout();
    setIsOpen(false);
  };

  if (isAuthed) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-lg transition-colors"
          title="Выйти"
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-lg transition-colors"
          title="Войти"
        >
          <LogIn className="h-4 w-4" />
          Войти
        </button>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 w-80">
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Вход в систему</h3>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setError(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>
            <input
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              placeholder="Логин"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoFocus
            />
            <input
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              placeholder="Пароль"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <button
              onClick={handleLogin}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              Войти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
