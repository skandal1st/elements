import { MessageSquare, X } from "lucide-react";
import { useChatStore } from "@/shared/store/chat.store";
import { ChatLayout } from "@/modules/chat/components/ChatLayout";

export function ChatWidget() {
  const { isOpen, isOnChatPage, toggle, close } = useChatStore();

  if (isOnChatPage) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end gap-2 pointer-events-none">
      {/* Панель — скрывается через CSS, не размонтируется чтобы не терять состояние */}
      <div
        className={`
          w-[420px] h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200
          flex flex-col overflow-hidden transition-all duration-200
          ${isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"}
        `}
        style={{ transformOrigin: "bottom right" }}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-brand-green" strokeWidth={2} />
            <span className="text-sm font-semibold text-gray-800">RocketChat</span>
          </div>
          <button
            onClick={close}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          <ChatLayout />
        </div>
      </div>

      {/* Кнопка открытия */}
      <button
        onClick={toggle}
        className={`
          pointer-events-auto
          w-14 h-14 rounded-full shadow-xl flex items-center justify-center
          transition-all duration-200 hover:scale-105 active:scale-95
          ${isOpen ? "bg-gray-700" : "bg-brand-green"}
        `}
        title={isOpen ? "Закрыть чат" : "Открыть чат"}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" strokeWidth={2} />
        ) : (
          <MessageSquare className="w-6 h-6 text-white" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}
