import { useEffect, useLayoutEffect, useRef } from "react";
import { useChatStore } from "@/shared/store/chat.store";
import type { RcMessage } from "@/shared/services/chat.service";

function formatTime(ts?: string) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatDate(ts?: string) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
    });
  } catch {
    return "";
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

interface Props {
  roomId: string;
  onLoadMore: () => void;
  hasMore: boolean;
}

export function MessageList({ roomId, onLoadMore, hasMore }: Props) {
  const { messages, isLoadingMessages } = useChatStore();
  const roomMessages = messages[roomId] ?? [];

  const containerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Флаги для управления прокруткой
  const isFirstRender = useRef(true);
  const isPrepending = useRef(false);
  const prevScrollHeight = useRef(0);

  // Скролл вниз при первой загрузке комнаты
  useEffect(() => {
    if (isFirstRender.current && roomMessages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
      isFirstRender.current = false;
    }
  }, [roomMessages.length]);

  // Сбросить флаг при смене комнаты
  useEffect(() => {
    isFirstRender.current = true;
    isPrepending.current = false;
  }, [roomId]);

  // Восстановить позицию прокрутки после prepend (load more)
  useLayoutEffect(() => {
    if (isPrepending.current && containerRef.current) {
      const newScrollHeight = containerRef.current.scrollHeight;
      containerRef.current.scrollTop += newScrollHeight - prevScrollHeight.current;
      isPrepending.current = false;
    }
  }, [roomMessages.length]);

  // IntersectionObserver: когда верхний sentinel виден — грузим историю
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingMessages && !isPrepending.current) {
          prevScrollHeight.current = container.scrollHeight;
          isPrepending.current = true;
          onLoadMore();
        }
      },
      { root: container, threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMessages, onLoadMore]);

  if (isLoadingMessages && roomMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Группируем сообщения по дате
  const groups: { date: string; messages: RcMessage[] }[] = [];
  roomMessages.forEach((msg) => {
    const date = formatDate(msg.ts);
    const last = groups[groups.length - 1];
    if (!last || last.date !== date) {
      groups.push({ date, messages: [msg] });
    } else {
      last.messages.push(msg);
    }
  });

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
      {/* Верхний sentinel для infinite scroll */}
      <div ref={topSentinelRef} className="h-1" />

      {hasMore && isLoadingMessages && (
        <div className="flex justify-center py-2">
          <div className="w-4 h-4 border-2 border-brand-green border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {groups.map((group) => (
        <div key={group.date}>
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 flex-shrink-0">{group.date}</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {group.messages.map((msg, idx) => {
            const prev = idx > 0 ? group.messages[idx - 1] : null;
            const sameUser = prev?.sender_username === msg.sender_username;
            const isSystem = Boolean(msg.t);

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center py-1">
                  <span className="text-xs text-gray-400 italic">{msg.text}</span>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex gap-2 ${sameUser ? "mt-0.5" : "mt-3"}`}>
                <div className="w-8 flex-shrink-0 flex items-start justify-center pt-0.5">
                  {!sameUser ? (
                    <div className="w-8 h-8 rounded-full bg-brand-green/20 text-brand-green text-xs font-bold flex items-center justify-center">
                      {getInitials(msg.sender_name || msg.sender_username)}
                    </div>
                  ) : null}
                </div>

                <div className="flex-1 min-w-0">
                  {!sameUser && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-800">
                        {msg.sender_name || msg.sender_username}
                      </span>
                      <span className="text-xs text-gray-400">{formatTime(msg.ts)}</span>
                    </div>
                  )}
                  <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                    {msg.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div ref={bottomRef} />
    </div>
  );
}
