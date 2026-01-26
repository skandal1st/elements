import { useState, useEffect } from "react";
import {
  User,
  Lock,
  MessageCircle,
  Loader2,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Unlink,
  Bell,
  BellOff,
  Send,
} from "lucide-react";
import { apiGet, apiPatch, apiPost, apiPut } from "../shared/api/client";
import { useAuthStore } from "../shared/store/auth.store";

type Me = {
  id: string;
  email: string;
  full_name: string;
  role?: string;
  roles?: Record<string, string>;
  is_superuser?: boolean;
  is_active?: boolean;
  modules?: string[];
};
type TelegramStatus = {
  enabled: boolean;
  user_linked: boolean;
  telegram_username: string | null;
  notifications_enabled: boolean;
  bot_username: string | null;
};
type LinkCode = { code: string; expires_at: string; bot_username: string };

export function ProfilePage() {
  const setUser = useAuthStore((s) => s.setUser);
  const [me, setMe] = useState<Me | null>(null);
  const [tg, setTg] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  const [linkCode, setLinkCode] = useState<LinkCode | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [togglingNotif, setTogglingNotif] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, tgRes] = await Promise.all([
        apiGet<Me>("/auth/me"),
        apiGet<TelegramStatus>("/it/telegram/status").catch(() => null),
      ]);
      setMe(meRes);
      setName(meRes.full_name || "");
      setTg(tgRes);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    setError(null);
    try {
      const u = await apiPatch<Me>("/auth/me", { full_name: name.trim() });
      setMe(u);
      setUser({
        id: u.id,
        email: u.email,
        full_name: u.full_name,
        role: u.role,
        roles: u.roles ?? {},
        is_superuser: u.is_superuser ?? false,
        is_active: u.is_active ?? true,
        modules: u.modules ?? [],
      });
      setSuccess("Имя обновлено");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async () => {
    if (newPass.length < 6) {
      setError("Новый пароль не короче 6 символов");
      return;
    }
    if (newPass !== confirmPass) {
      setError("Пароли не совпадают");
      return;
    }
    setChangingPass(true);
    setError(null);
    try {
      await apiPost("/auth/change-password", {
        current_password: currentPass,
        new_password: newPass,
      });
      setCurrentPass("");
      setNewPass("");
      setConfirmPass("");
      setSuccess("Пароль изменён");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChangingPass(false);
    }
  };

  const generateCode = async () => {
    setGeneratingCode(true);
    setError(null);
    try {
      const d = await apiPost<LinkCode>("/it/telegram/generate-link-code");
      setLinkCode(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGeneratingCode(false);
    }
  };

  const unlinkTg = async () => {
    if (!window.confirm("Отвязать Telegram? Уведомления перестанут приходить.")) return;
    setUnlinking(true);
    setError(null);
    try {
      await apiPost("/it/telegram/unlink");
      setLinkCode(null);
      await load();
      setSuccess("Telegram отвязан");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUnlinking(false);
    }
  };

  const toggleNotif = async () => {
    if (!tg) return;
    setTogglingNotif(true);
    setError(null);
    try {
      await apiPut("/it/telegram/settings", {
        telegram_notifications: !tg.notifications_enabled,
      });
      setTg((p) => (p ? { ...p, notifications_enabled: !p.notifications_enabled } : null));
      setSuccess(tg.notifications_enabled ? "Уведомления выключены" : "Уведомления включены");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTogglingNotif(false);
    }
  };

  const sendTest = async () => {
    setSendingTest(true);
    setError(null);
    try {
      const r = await apiPost<{ message: string }>("/it/telegram/test-notification");
      setSuccess(r.message || "Отправлено");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSendingTest(false);
    }
  };

  const copyCode = async () => {
    if (!linkCode) return;
    try {
      await navigator.clipboard.writeText(linkCode.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-10 h-10 border-4 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="glass-card-purple p-6">
        <h2 className="text-2xl font-bold text-white mb-1">Настройки пользователя</h2>
        <p className="text-gray-400">Имя, пароль и уведомления Telegram</p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-400" />
          <p className="text-sm text-green-400">{success}</p>
        </div>
      )}

      {/* Имя */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-accent-purple" />
          <h3 className="text-lg font-semibold text-white">Имя</h3>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">ФИО</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="glass-input w-full px-4 py-3"
              placeholder="ФИО"
            />
          </div>
          <button
            onClick={saveName}
            disabled={savingName || !name.trim()}
            className="glass-button px-4 py-3 flex items-center gap-2 disabled:opacity-50"
          >
            {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Сохранить
          </button>
        </div>
        {me && (
          <p className="text-xs text-gray-500 mt-2">Email: {me.email}</p>
        )}
      </div>

      {/* Пароль */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-5 h-5 text-accent-purple" />
          <h3 className="text-lg font-semibold text-white">Сменить пароль</h3>
        </div>
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Текущий пароль</label>
            <input
              type="password"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              className="glass-input w-full px-4 py-3"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Новый пароль</label>
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="glass-input w-full px-4 py-3"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Повторите новый пароль</label>
            <input
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              className="glass-input w-full px-4 py-3"
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>
          <button
            onClick={changePassword}
            disabled={changingPass || !currentPass || !newPass || newPass !== confirmPass}
            className="glass-button px-4 py-3 flex items-center gap-2 disabled:opacity-50"
          >
            {changingPass ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Сменить пароль
          </button>
        </div>
      </div>

      {/* Telegram */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <MessageCircle className="w-5 h-5 text-accent-purple" />
          <h3 className="text-lg font-semibold text-white">Уведомления в Telegram</h3>
        </div>
        {!tg?.enabled && (
          <p className="text-gray-400 text-sm">
            Интеграция с Telegram отключена администратором.
          </p>
        )}
        {tg?.enabled && !tg.user_linked && (
          <div className="space-y-4">
            {!linkCode ? (
              <button
                onClick={generateCode}
                disabled={generatingCode}
                className="glass-button flex items-center gap-2 px-4 py-3"
              >
                {generatingCode ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {generatingCode ? "Генерация кода..." : "Получить код привязки"}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-dark-700/50 border border-dark-600/50 flex items-center justify-between gap-3">
                  <span className="text-2xl font-mono font-bold text-white tracking-widest">{linkCode.code}</span>
                  <button
                    onClick={copyCode}
                    className="p-2 text-gray-400 hover:text-white rounded-lg"
                    title="Скопировать"
                  >
                    {copied ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <a
                  href={`https://t.me/${linkCode.bot_username}?start=${linkCode.code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-accent-purple hover:text-white bg-accent-purple/10 hover:bg-accent-purple/20 rounded-xl"
                >
                  <ExternalLink className="w-4 h-4" />
                  Открыть @{linkCode.bot_username}
                </a>
                <button onClick={generateCode} disabled={generatingCode} className="text-sm text-gray-500 hover:text-gray-300">
                  Новый код
                </button>
              </div>
            )}
          </div>
        )}
        {tg?.enabled && tg.user_linked && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">
              Аккаунт: <span className="text-white font-medium">@{tg.telegram_username || "—"}</span>
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                {tg.notifications_enabled ? <Bell className="w-5 h-5 text-accent-purple" /> : <BellOff className="w-5 h-5 text-gray-400" />}
                <span className="text-sm text-gray-400">
                  {tg.notifications_enabled ? "Уведомления включены" : "Уведомления выключены"}
                </span>
                <button
                  onClick={toggleNotif}
                  disabled={togglingNotif}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${tg.notifications_enabled ? "bg-accent-purple" : "bg-dark-600"}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${tg.notifications_enabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              <button
                onClick={sendTest}
                disabled={sendingTest || !tg.notifications_enabled}
                className="glass-button flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {sendingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Тест
              </button>
              <button
                onClick={unlinkTg}
                disabled={unlinking}
                className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-xl disabled:opacity-50"
              >
                {unlinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                Отвязать
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
