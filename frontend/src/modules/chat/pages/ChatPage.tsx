import { useEffect } from "react";
import { useChatStore } from "@/shared/store/chat.store";
import { ChatLayout } from "../components/ChatLayout";

export function ChatPage() {
  const setOnChatPage = useChatStore((s) => s.setOnChatPage);

  useEffect(() => {
    setOnChatPage(true);
    return () => setOnChatPage(false);
  }, [setOnChatPage]);

  return (
    <div className="-m-6 h-[calc(100vh-73px)]">
      <ChatLayout />
    </div>
  );
}
