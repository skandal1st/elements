import { get } from "../lib/api";

export interface ReportFilters {
  date_from: string;
  date_to: string;
  category?: string;
  priority?: string;
}

export interface TicketSummary {
  total_tickets: number;
  open_tickets: number;
  resolved_tickets: number;
  closed_tickets: number;
  avg_resolution_time_hours: number | null;
  avg_rating: number | null;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface PriorityCount {
  priority: string;
  count: number;
}

export interface ResolutionDetail {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  resolution_time_hours: number | null;
  creator_name: string;
  assignee_name: string | null;
}

export interface TopCreator {
  user_id: string;
  user_name: string;
  user_email: string;
  department: string | null;
  ticket_count: number;
}

export interface TicketReportData {
  summary: TicketSummary;
  by_status: StatusCount[];
  by_category: CategoryCount[];
  by_priority: PriorityCount[];
  resolution_details: ResolutionDetail[];
  top_creators: TopCreator[];
}

export const reportsService = {
  async getTicketReport(filters: ReportFilters): Promise<{
    data: TicketReportData | null;
    error: Error | null;
  }> {
    const params = new URLSearchParams();
    params.append("date_from", filters.date_from);
    params.append("date_to", filters.date_to);
    if (filters.category) params.append("category", filters.category);
    if (filters.priority) params.append("priority", filters.priority);

    const { data, error } = await get<{ data: TicketReportData }>(
      `/reports/tickets?${params.toString()}`
    );

    if (error || !data) {
      return {
        data: null,
        error: error || new Error("Ошибка загрузки отчёта"),
      };
    }

    return { data: data.data, error: null };
  },
};
