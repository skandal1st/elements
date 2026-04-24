import { useEffect, useRef, useState } from "react";
import { Hash, Lock, MessageSquare } from "lucide-react";
import { RoomList } from "./RoomList";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { RcLoginModal } from "./RcLoginModal";
import { useChatStore } from "@/shared/store/chat.store";
import { chatService } from "@/shared/services/chat.service";
import type { RcMessage } from "@/shared/services/chat.service";

const PAGE_SIZE = 50;

function RoomHeader() {
  const { rooms, currentRoomId, currentRoomType } = useChatStore();
  const room = rooms.find((r) => r.id === currentRoomId);
  if (!room) return null;

  const icon =
    currentRoomType === "d" ? (
      <MessageSquare className="w-4 h-4" />
    ) : currentRoomType === "p" ? (
      <Lock className="w-4 h-4" />
    ) : (
      <Hash className="w-4 h-4" />
    );

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-white flex-shrink-0">
      <span className="text-gray-400">{icon}</span>
      <span className="font-semibold text-gray-800 text-sm">
        {room.display_name || room.name}
      </span>
    </div>
  );
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // игнорируем — браузер может блокировать AudioContext без жеста пользователя
  }
}

function showNotification(senderName: string, text: string) {
  if (
    !("Notification" in window) ||
    Notification.permission !== "granted" ||
    document.visibilityState === "visible"
  )
    return;
  try {
    new Notification(senderName, {
      body: text.length > 80 ? text.slice(0, 80) + "…" : text,
      icon: "/logo-icon.png",
      tag: "rc-message",
    });
  } catch {
    // игнорируем если браузер не поддерживает
  }
}

function useChatWebSocket() {
  const { currentRoomId, addMessages, setUnreadCount } = useChatStore();
  const currentRoomIdRef = useRef(currentRoomId);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);

  useEffect(() => {
    currentRoomIdRef.current = currentRoomId;
  }, [currentRoomId]);

  useEffect(() => {
    unmounted.current = false;
    requestNotificationPermission();

    function connect() {
      const token = localStorage.getItem("token");
      if (!token) return;

      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${proto}//${window.location.host}/api/v1/it/chat/ws?token=${token}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data);
          if (event.type !== "new_message") return;
          const msg = event.message as RcMessage;
          const roomId = event.room_id as string;
          addMessages(roomId, [msg]);
          if (roomId !== currentRoomIdRef.current) {
            setUnreadCount(roomId, (useChatStore.getState().unreadCounts[roomId] ?? 0) + 1);
            showNotification(msg.sender_name || msg.sender_username, msg.text);
          }
          playNotificationSound();
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        if (unmounted.current) return;
        reconnectTimer.current = setTimeout(connect, 4000);
      };

      ws.onerror = () => ws.close();
    }

    connect();

    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);
}

export function ChatLayout() {
  const {
    currentRoomId,
    currentRoomType,
    setRooms,
    addMessages,
    setUnreadCount,
    setLoadingRooms,
    setLoadingMessages,
    isLoadingRooms,
  } = useChatStore();

  useChatWebSocket();

  const [hasMore, setHasMore] = useState(false);
  const [needRcLogin, setNeedRcLogin] = useState(false);
  const offsetRef = useRef(0);
  const loadedRoomRef = useRef<string | null>(null);

  const loadRooms = async () => {
    setLoadingRooms(true);
    try {
      const rooms = await chatService.getRooms();
      setRooms(rooms);
      setNeedRcLogin(false);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? "";
      if (msg.includes("rc_login_required")) {
        setNeedRcLogin(true);
      } else {
        console.error("Ошибка загрузки комнат:", e);
      }
    } finally {
      setLoadingRooms(false);
    }
  };

  const loadMessages = async (roomId: string, roomType: string, offset = 0) => {
    setLoadingMessages(true);
    try {
      const data = await chatService.getMessages(roomId, roomType, offset, PAGE_SIZE);
      // RC возвращает сообщения от новых к старым — разворачиваем
      const ordered = [...data.messages].reverse();
      addMessages(roomId, ordered, offset > 0);
      setHasMore(data.total > offset + PAGE_SIZE);
      offsetRef.current = offset + data.messages.length;

      // Снимаем unread
      setUnreadCount(roomId, 0);
      chatService.markRead(roomId).catch(() => {});
    } catch (e) {
      console.error("Ошибка загрузки сообщений:", e);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleLoadMore = () => {
    if (!currentRoomId) return;
    loadMessages(currentRoomId, currentRoomType, offsetRef.current);
  };

  const handleSend = async (text: string) => {
    if (!currentRoomId) return;
    const msg = await chatService.sendMessage(currentRoomId, text);
    addMessages(currentRoomId, [msg]);
  };

  // Загружаем комнаты при монтировании
  useEffect(() => {
    loadRooms();
  }, []);

  // Загружаем сообщения при смене комнаты
  useEffect(() => {
    if (!currentRoomId) return;
    if (loadedRoomRef.current === currentRoomId) return;
    loadedRoomRef.current = currentRoomId;
    offsetRef.current = 0;
    setHasMore(false);
    loadMessages(currentRoomId, currentRoomType);
  }, [currentRoomId]);

  if (needRcLogin) {
    return <RcLoginModal onSuccess={loadRooms} />;
  }

  return (
    <div className="flex h-full overflow-hidden">
      <RoomList onRefresh={loadRooms} isLoading={isLoadingRooms} />

      {currentRoomId ? (
        <div className="flex flex-col flex-1 min-w-0 h-full">
          <RoomHeader />
          <MessageList
            roomId={currentRoomId}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
          />
          <MessageInput onSend={handleSend} />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Выберите канал для начала общения</p>
          </div>
        </div>
      )}
    </div>
  );
}
