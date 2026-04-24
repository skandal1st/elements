import { useState } from "react";
import { MessageSquare, Eye, EyeOff, Loader2 } from "lucide-react";
import { chatService } from "@/shared/services/chat.service";

interface Props {
  onSuccess: () => void;
}

export function RcLoginModal({ onSuccess }: Props) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await chatService.connect(password);
      onSuccess();
    } catch {
      setError("Неверный пароль или ошибка подключения к RocketChat");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12 text-center">
      <div className="w-12 h-12 rounded-2xl bg-brand-green/10 flex items-center justify-center mb-4">
        <MessageSquare className="w-6 h-6 text-brand-green" />
      </div>

      <h2 className="text-base font-semibold text-gray-800 mb-1">
        Войдите в RocketChat
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        Введите пароль от вашего аккаунта RocketChat, чтобы начать общение
      </p>

      <form onSubmit={handleSubmit} className="w-full max-w-xs space-y-3">
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль RocketChat"
            autoFocus
            className="w-full px-3 py-2.5 pr-10 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand-green transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-500 text-left">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password.trim()}
          className="w-full py-2.5 rounded-xl bg-brand-green text-white text-sm font-medium hover:bg-brand-green/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Подключение..." : "Войти"}
        </button>
      </form>

      <p className="text-xs text-gray-400 mt-4">
        Ваш пароль используется только для авторизации в RocketChat
      </p>
    </div>
  );
}
