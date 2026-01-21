import { Context } from 'telegraf';
import type { Update } from 'telegraf/types';

export interface BotUser {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'it_specialist' | 'employee';
  telegram_id: number;
  telegram_notifications: boolean;
}

export interface BotState {
  user?: BotUser;
  pendingCommentTicketId?: string;
  pendingTicketEquipmentId?: string;
}

export type BotContext = Context<Update> & {
  state: BotState;
};

export interface TicketData {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  creator_name?: string;
  creator_department?: string;
  assignee_name?: string;
  location_department?: string;
  location_room?: string;
  equipment_name?: string;
  created_at: string;
}

export interface EquipmentData {
  id: string;
  name: string;
  model?: string;
  inventory_number: string;
  serial_number?: string;
  category: string;
  status: string;
  manufacturer?: string;
  owner_name?: string;
  location_department?: string;
  location_room?: string;
  purchase_date?: string;
  warranty_until?: string;
}

export type TicketStatus = 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed' | 'pending_user';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
