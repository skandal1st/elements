import { useEffect, useState, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight, Search, User, Loader2, AtSign, Send } from "lucide-react";
import { chatService } from "@/shared/services/chat.service";
import type { RcChatUser } from "@/shared/services/chat.service";

interface Department {
  id: number;
  name: string;
  users: RcChatUser[];
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

interface UserRowProps {
  user: RcChatUser;
  onSelect: (user: RcChatUser) => void;
  loading: boolean;
}

function UserRow({ user, onSelect, loading }: UserRowProps) {
  return (
    <button
      onClick={() => onSelect(user)}
      disabled={loading}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-100 transition-colors rounded-lg disabled:opacity-50"
    >
      <div className="w-7 h-7 rounded-full bg-brand-green/15 text-brand-green text-[10px] font-bold flex items-center justify-center flex-shrink-0">
        {getInitials(user.full_name)}
      </div>
      <span className="flex-1 truncate text-sm text-gray-700">{user.full_name}</span>
    </button>
  );
}

interface Props {
  onStartDm: (roomId: string) => void;
}

export function UserList({ onStartDm }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [withoutDept, setWithoutDept] = useState<RcChatUser[]>([]);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");
  const [loadingUser, setLoadingUser] = useState<string | null>(null);
  const [dmError, setDmError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [manualUsername, setManualUsername] = useState("");
  const manualRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsLoading(true);
    chatService
      .getUsers()
      .then((data) => {
        setDepartments(data.departments);
        setWithoutDept(data.without_department);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const toggleDept = (id: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const openDm = async (rcUsername: string, label: string) => {
    setLoadingUser(rcUsername);
    setDmError(null);
    try {
      const dm = await chatService.createDm(rcUsername);
      onStartDm(dm.room_id);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "Не удалось открыть переписку";
      setDmError(`${label}: ${msg}`);
    } finally {
      setLoadingUser(null);
    }
  };

  const handleSelect = (user: RcChatUser) => openDm(user.rc_username, user.full_name);

  const handleManualOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = manualUsername.trim().replace(/^@/, "");
    if (!username) return;
    await openDm(username, `@${username}`);
    setManualUsername("");
  };

  const q = search.toLowerCase();

  const filteredDepts = useMemo(
    () =>
      departments
        .map((d) => ({
          ...d,
          users: q ? d.users.filter((u) => u.full_name.toLowerCase().includes(q)) : d.users,
        }))
        .filter((d) => d.users.length > 0),
    [departments, q]
  );

  const filteredNoDept = useMemo(
    () => (q ? withoutDept.filter((u) => u.full_name.toLowerCase().includes(q)) : withoutDept),
    [withoutDept, q]
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Поиск */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-1.5">
          <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск сотрудника..."
            className="flex-1 bg-transparent text-xs text-gray-700 placeholder-gray-400 outline-none"
          />
        </div>
      </div>

      {dmError && (
        <div className="px-3 py-1.5 bg-red-50 border-b border-red-100">
          <p className="text-[11px] text-red-500">{dmError}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-1 px-2 space-y-0.5">
        {filteredDepts.map((dept) => {
          const isCollapsed = collapsed.has(dept.id);
          return (
            <div key={dept.id}>
              <button
                onClick={() => toggleDept(dept.id)}
                className="w-full flex items-center gap-1 px-2 py-1 text-left"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                )}
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide truncate">
                  {dept.name}
                </span>
                <span className="ml-auto text-[10px] text-gray-400">{dept.users.length}</span>
              </button>

              {!isCollapsed && (
                <div className="pl-2">
                  {dept.users.map((user) => (
                    <UserRow
                      key={user.rc_username}
                      user={user}
                      onSelect={handleSelect}
                      loading={loadingUser === user.rc_username}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {filteredNoDept.length > 0 && (
          <div>
            {filteredDepts.length > 0 && (
              <div className="px-2 py-1">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                  Без отдела
                </span>
              </div>
            )}
            {filteredNoDept.map((user) => (
              <UserRow
                key={user.rc_username}
                user={user}
                onSelect={handleSelect}
                loading={loadingUser === user.rc_username}
              />
            ))}
          </div>
        )}

        {filteredDepts.length === 0 && filteredNoDept.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <User className="w-8 h-8 text-gray-200 mb-2" />
            <p className="text-xs text-gray-400">Сотрудники не найдены</p>
          </div>
        )}
      </div>

      {/* Открыть DM по RC-логину вручную */}
      <div className="border-t border-gray-100 px-3 py-2">
        <p className="text-[10px] text-gray-400 mb-1.5 flex items-center gap-1">
          <AtSign className="w-3 h-3" />
          Написать по логину RC
        </p>
        <form onSubmit={handleManualOpen} className="flex gap-1.5">
          <input
            ref={manualRef}
            type="text"
            value={manualUsername}
            onChange={(e) => setManualUsername(e.target.value)}
            placeholder="rc.username"
            className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-brand-green transition-colors"
          />
          <button
            type="submit"
            disabled={!manualUsername.trim() || loadingUser === manualUsername.trim().replace(/^@/, "")}
            className="p-1.5 rounded-lg bg-brand-green text-white hover:bg-brand-green/90 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            {loadingUser === manualUsername.trim().replace(/^@/, "") ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
