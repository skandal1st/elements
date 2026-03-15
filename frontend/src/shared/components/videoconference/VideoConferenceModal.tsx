import { useState, useEffect, useMemo } from "react";
import { X, Search, Video, Loader2 } from "lucide-react";
import { apiGet, apiPost } from "../../api/client";
import { useAuthStore } from "../../store/auth.store";

interface UserItem {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
}

interface VideoConferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StartResponse {
  room_url: string;
  room_id: string;
  invited_count: number;
}

export function VideoConferenceModal({ isOpen, onClose }: VideoConferenceModalProps) {
  const currentUser = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setSelected(new Set());
    setError("");
    setLoading(true);
    apiGet<UserItem[]>("/hr/users/")
      .then((data) => {
        setUsers(data.filter((u) => u.is_active));
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users
      .filter((u) => u.id !== currentUser?.id)
      .filter((u) => {
        if (!q) return true;
        return (
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
        );
      });
  }, [users, search, currentUser?.id]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStart = async () => {
    if (selected.size === 0) {
      setError("Выберите хотя бы одного участника");
      return;
    }
    setError("");
    setStarting(true);
    try {
      const res = await apiPost<StartResponse>("/it/videoconference/start", {
        user_ids: Array.from(selected),
      });
      window.open(res.room_url, "_blank");
      onClose();
    } catch (e: any) {
      setError(e.message || "Ошибка при создании конференции");
    } finally {
      setStarting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-900">Видеоконференция</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по имени или email..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {selected.size > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Выбрано: {selected.size}
            </p>
          )}
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500">
              {search ? "Никого не найдено" : "Нет доступных пользователей"}
            </div>
          ) : (
            filtered.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(u.id)}
                  onChange={() => toggle(u.id)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
              </label>
            ))
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-6 py-2">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleStart}
            disabled={starting || selected.size === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {starting && <Loader2 className="w-4 h-4 animate-spin" />}
            Начать
          </button>
        </div>
      </div>
    </div>
  );
}
