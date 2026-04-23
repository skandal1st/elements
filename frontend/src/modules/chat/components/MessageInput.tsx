import { useState, useRef, KeyboardEvent } from "react";
import { Send } from "lucide-react";

interface Props {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed);
      setText("");
      textareaRef.current?.focus();
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-4 py-3 border-t border-gray-100 bg-white flex-shrink-0">
      <div className="flex items-end gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-brand-green transition-colors">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Написать сообщение... (Enter — отправить, Shift+Enter — перенос)"
          disabled={disabled || sending}
          rows={1}
          className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none outline-none max-h-32 overflow-y-auto leading-relaxed"
          style={{ minHeight: "24px" }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending || disabled}
          className="p-1.5 rounded-lg bg-brand-green text-white hover:bg-brand-green/90 disabled:opacity-40 transition-colors flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[10px] text-gray-400 mt-1 text-right">
        Shift+Enter — новая строка
      </p>
    </div>
  );
}
