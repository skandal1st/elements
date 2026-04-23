import { create } from "zustand";
import type { RcRoom, RcMessage } from "@/shared/services/chat.service";

interface ChatStore {
  // UI
  isOpen: boolean;
  isOnChatPage: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setOnChatPage: (v: boolean) => void;

  // Данные
  rooms: RcRoom[];
  currentRoomId: string | null;
  currentRoomType: string;
  messages: Record<string, RcMessage[]>;
  unreadCounts: Record<string, number>;
  isLoadingRooms: boolean;
  isLoadingMessages: boolean;

  // Actions
  setRooms: (rooms: RcRoom[]) => void;
  setCurrentRoom: (roomId: string | null, roomType?: string) => void;
  addMessages: (roomId: string, msgs: RcMessage[], prepend?: boolean) => void;
  setUnreadCount: (roomId: string, count: number) => void;
  setLoadingRooms: (v: boolean) => void;
  setLoadingMessages: (v: boolean) => void;
  clearMessages: (roomId: string) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  isOpen: false,
  isOnChatPage: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOnChatPage: (v) => set({ isOnChatPage: v }),

  rooms: [],
  currentRoomId: null,
  currentRoomType: "c",
  messages: {},
  unreadCounts: {},
  isLoadingRooms: false,
  isLoadingMessages: false,

  setRooms: (rooms) => {
    const unreadCounts: Record<string, number> = {};
    rooms.forEach((r) => {
      unreadCounts[r.id] = r.unread;
    });
    set({ rooms, unreadCounts });
  },

  setCurrentRoom: (roomId, roomType = "c") =>
    set({ currentRoomId: roomId, currentRoomType: roomType }),

  addMessages: (roomId, msgs, prepend = false) =>
    set((s) => {
      const existing = s.messages[roomId] ?? [];
      const merged = prepend ? [...msgs, ...existing] : [...existing, ...msgs];
      // дедупликация по id
      const seen = new Set<string>();
      const deduped = merged.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      });
      return { messages: { ...s.messages, [roomId]: deduped } };
    }),

  setUnreadCount: (roomId, count) =>
    set((s) => ({ unreadCounts: { ...s.unreadCounts, [roomId]: count } })),

  setLoadingRooms: (v) => set({ isLoadingRooms: v }),
  setLoadingMessages: (v) => set({ isLoadingMessages: v }),

  clearMessages: (roomId) =>
    set((s) => {
      const next = { ...s.messages };
      delete next[roomId];
      return { messages: next };
    }),
}));
