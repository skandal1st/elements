import { create } from "zustand";

interface ChatStore {
  isOpen: boolean;
  isOnChatPage: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setOnChatPage: (v: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  isOnChatPage: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOnChatPage: (v) => set({ isOnChatPage: v }),
}));
