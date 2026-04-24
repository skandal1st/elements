import { useState } from "react";
import { Hash, Lock, MessageSquare, RefreshCw, Users } from "lucide-react";
import { useChatStore } from "@/shared/store/chat.store";
import { UserList } from "./UserList";
import type { RcRoom } from "@/shared/services/chat.service";

interface Props {
  onRefresh: () => void;
  isLoading: boolean;
}

function roomIcon(type: string) {
  if (type === "d") return <MessageSquare className="w-4 h-4 flex-shrink-0" />;
  if (type === "p") return <Lock className="w-4 h-4 flex-shrink-0" />;
  return <Hash className="w-4 h-4 flex-shrink-0" />;
}

type Tab = "rooms" | "users";

export function RoomList({ onRefresh, isLoading }: Props) {
  const { rooms, currentRoomId, unreadCounts, setCurrentRoom } = useChatStore();
  const [tab, setTab] = useState<Tab>("rooms");

  const sorted = [...rooms].sort((a, b) => {
    const ua = unreadCounts[a.id] ?? 0;
    const ub = unreadCounts[b.id] ?? 0;
    return ub - ua;
  });

  const handleDmOpen = (roomId: string) => {
    setCurrentRoom(roomId, "d");
    // Если комнаты нет в списке — обновим
    if (!rooms.find((r) => r.id === roomId)) {
      onRefresh();
    }
  };

  return (
    <div className="w-56 flex-shrink-0 flex flex-col border-r border-gray-100 bg-gray-50 h-full">
      {/* Вкладки */}
      <div className="flex border-b border-gray-100">
        <button
          onClick={() => setTab("rooms")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
            tab === "rooms"
              ? "text-brand-green border-b-2 border-brand-green"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          Каналы
        </button>
        <button
          onClick={() => setTab("users")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
            tab === "users"
              ? "text-brand-green border-b-2 border-brand-green"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Сотрудники
        </button>
      </div>

      {tab === "rooms" && (
        <>
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Каналы
            </span>
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors disabled:opacity-50"
              title="Обновить"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1">
            {rooms.length === 0 && !isLoading && (
              <p className="text-xs text-gray-400 text-center mt-6 px-3">
                Нет доступных каналов
              </p>
            )}
            {sorted.map((room: RcRoom) => {
              const unread = unreadCounts[room.id] ?? 0;
              const active = room.id === currentRoomId;
              return (
                <button
                  key={room.id}
                  onClick={() => setCurrentRoom(room.id, room.type)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors
                    ${active
                      ? "bg-brand-green/10 text-brand-green"
                      : "text-gray-700 hover:bg-gray-100"
                    }
                  `}
                >
                  <span className={active ? "text-brand-green" : "text-gray-400"}>
                    {roomIcon(room.type)}
                  </span>
                  <span className="flex-1 truncate text-sm">
                    {room.display_name || room.name}
                  </span>
                  {unread > 0 && (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 bg-brand-green text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {tab === "users" && <UserList onStartDm={handleDmOpen} />}
    </div>
  );
}
