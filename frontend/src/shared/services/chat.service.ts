import { apiGet, apiPost } from "@/shared/api/client";

export interface RcRoom {
  id: string;
  name: string;
  display_name: string;
  type: string; // c=channel, p=private, d=dm
  unread: number;
  alert: boolean;
  last_message?: unknown;
}

export interface RcMessage {
  id: string;
  room_id: string;
  text: string;
  sender_name: string;
  sender_username: string;
  ts?: string;
  attachments?: unknown[];
  t?: string; // системный тип сообщения
}

export interface RcSubscription {
  room_id: string;
  unread: number;
  alert: boolean;
}

export interface RcChatUser {
  full_name: string;
  email?: string;
  rc_username: string;
  department_id?: number;
  department_name?: string;
}

const BASE = "/it/chat";

export const chatService = {
  getRooms: () =>
    apiGet<{ rooms: RcRoom[] }>(`${BASE}/rooms`).then((r) => r.rooms),

  getMessages: (
    roomId: string,
    roomType: string,
    offset = 0,
    count = 50
  ) =>
    apiGet<{ messages: RcMessage[]; total: number }>(
      `${BASE}/rooms/${roomId}/messages?room_type=${roomType}&count=${count}&offset=${offset}`
    ),

  sendMessage: (roomId: string, text: string) =>
    apiPost<RcMessage>(`${BASE}/rooms/${roomId}/messages`, { text }),

  getSubscriptions: () =>
    apiGet<RcSubscription[]>(`${BASE}/subscriptions`),

  markRead: (roomId: string) =>
    apiPost<{ success: boolean }>(`${BASE}/rooms/${roomId}/read`, {}),

  connect: (username: string, password: string) =>
    apiPost<{ success: boolean }>(`${BASE}/connect`, { username, password }),

  getUsers: () =>
    apiGet<{
      departments: { id: number; name: string; users: RcChatUser[] }[];
      without_department: RcChatUser[];
    }>(`${BASE}/users`),

  createDm: (rc_username: string) =>
    apiPost<{ room_id: string; room_type: string }>(`${BASE}/dm`, { rc_username }),
};
};
