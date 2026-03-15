import { useState } from "react";
import {
  FileCheck,
  Headset,
  MessageSquare,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";

interface PendingApproval {
  document_id: string;
  document_title: string;
  deadline_at: string | null;
  creator_name: string | null;
}

interface AssignedTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string | null;
}

interface OverdueTask {
  id: string;
  title: string;
  project_id: string;
  project_title: string | null;
  due_date: string | null;
  days_overdue: number;
  priority: string;
}

export interface ActionItemsData {
  pending_approvals?: PendingApproval[];
  pending_approvals_count?: number;
  assigned_tickets?: AssignedTicket[];
  assigned_tickets_count?: number;
  my_tickets_by_status?: Record<string, number>;
  overdue_tasks?: OverdueTask[];
  overdue_tasks_count?: number;
}

interface ActionCenterProps {
  data: ActionItemsData;
  hasModule: (mod: string) => boolean;
}

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
  urgent: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  new: "Новые",
  in_progress: "В работе",
  waiting: "Ожидание",
  resolved: "Решённые",
  pending_user: "Ожидает ответа",
};

const ticketStatusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  waiting: "bg-purple-100 text-purple-700",
  resolved: "bg-green-100 text-green-700",
  pending_user: "bg-orange-100 text-orange-700",
};

function CollapsibleSection({
  title,
  icon,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-gray-200 text-xs font-semibold text-gray-600">
            {count}
          </span>
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {open && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function ActionCenter({ data, hasModule }: ActionCenterProps) {
  const hasPendingApprovals =
    hasModule("documents") &&
    data.pending_approvals &&
    data.pending_approvals.length > 0;
  const hasAssignedTickets =
    hasModule("it") &&
    data.assigned_tickets &&
    data.assigned_tickets.length > 0;
  const hasMyTickets =
    hasModule("it") &&
    data.my_tickets_by_status &&
    Object.keys(data.my_tickets_by_status).length > 0;
  const hasOverdueTasks =
    hasModule("tasks") &&
    data.overdue_tasks &&
    data.overdue_tasks.length > 0;

  if (!hasPendingApprovals && !hasAssignedTickets && !hasMyTickets && !hasOverdueTasks) {
    return null;
  }

  const totalCount =
    (data.pending_approvals_count ?? 0) +
    (data.assigned_tickets_count ?? 0) +
    (data.overdue_tasks_count ?? 0);

  return (
    <div className="portal-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
        </div>
        <h3 className="text-gray-800 font-medium">Требует внимания</h3>
        {totalCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-amber-100 text-xs font-bold text-amber-700">
            {totalCount}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Документы на согласование */}
        {hasPendingApprovals && (
          <CollapsibleSection
            title="На согласование"
            icon={<FileCheck className="w-4 h-4 text-brand-green" />}
            count={data.pending_approvals_count ?? 0}
          >
            <div className="space-y-2">
              {data.pending_approvals!.map((item) => (
                <a
                  key={item.document_id}
                  href={`/documents/view/${item.document_id}`}
                  className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50/80 hover:bg-gray-100/80 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-brand-green transition-colors truncate">
                      {item.document_title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.creator_name && <span>от {item.creator_name}</span>}
                      {item.deadline_at && (
                        <span className="ml-2 text-amber-600">
                          до {new Date(item.deadline_at).toLocaleDateString("ru-RU")}
                        </span>
                      )}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Назначенные тикеты */}
        {hasAssignedTickets && (
          <CollapsibleSection
            title="Назначенные заявки"
            icon={<Headset className="w-4 h-4 text-blue-500" />}
            count={data.assigned_tickets_count ?? 0}
          >
            <div className="space-y-2">
              {data.assigned_tickets!.map((ticket) => (
                <a
                  key={ticket.id}
                  href={`/it/tickets/${ticket.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50/80 hover:bg-gray-100/80 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 transition-colors truncate">
                      {ticket.title}
                    </p>
                  </div>
                  <span
                    className={`flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${priorityColors[ticket.priority] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {ticket.priority}
                  </span>
                  <span
                    className={`flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${ticketStatusColors[ticket.status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {statusLabels[ticket.status] ?? ticket.status}
                  </span>
                </a>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Мои заявки */}
        {hasMyTickets && (
          <CollapsibleSection
            title="Мои заявки"
            icon={<MessageSquare className="w-4 h-4 text-purple-500" />}
            count={Object.values(data.my_tickets_by_status!).reduce(
              (a, b) => a + b,
              0
            )}
            defaultOpen={false}
          >
            <div className="flex flex-wrap gap-2 p-2">
              {Object.entries(data.my_tickets_by_status!).map(
                ([status, count]) => (
                  <div
                    key={status}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${ticketStatusColors[status] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    <span>{statusLabels[status] ?? status}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                )
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Просроченные задачи */}
        {hasOverdueTasks && (
          <CollapsibleSection
            title="Просроченные задачи"
            icon={<Clock className="w-4 h-4 text-red-500" />}
            count={data.overdue_tasks_count ?? 0}
          >
            <div className="space-y-2">
              {data.overdue_tasks!.map((task) => (
                <a
                  key={task.id}
                  href={`/tasks/board/${task.project_id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-gray-50/80 hover:bg-gray-100/80 transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-red-600 transition-colors truncate">
                      {task.title}
                    </p>
                    {task.project_title && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {task.project_title}
                      </p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                    {task.days_overdue} дн.
                  </span>
                  <span
                    className={`flex-shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${priorityColors[task.priority] ?? "bg-gray-100 text-gray-600"}`}
                  >
                    {task.priority}
                  </span>
                </a>
              ))}
            </div>
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
