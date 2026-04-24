import { useEffect, useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, User, Loader2 } from "lucide-react";
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
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSelect = async (user: RcChatUser) => {
    setLoadingUser(user.rc_username);
    try {
      const dm = await chatService.createDm(user.rc_username);
      onStartDm(dm.room_id);
    } catch (e) {
      console.error("Ошибка открытия DM:", e);
    } finally {
      setLoadingUser(null);
    }
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
    </div>
  );
}
