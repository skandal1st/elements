import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  ListTodo,
  CalendarPlus,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  setHours,
  setMinutes,
  parseISO,
  isWithinInterval,
  getHours,
  getMinutes,
} from "date-fns";
import { ru } from "date-fns/locale";
import { apiGet, apiPost } from "../../../shared/api/client";
import { useTasksStore, type Project } from "../../../shared/store/tasks.store";

type CalendarItem = {
  id: string;
  title: string;
  description?: string | null;
  start_at: string | null;
  end_at: string | null;
  is_all_day: boolean;
  type: "event" | "task";
  color?: string;
  status?: string;
  priority?: string;
  project_id?: string;
};

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 22;
const SLOT_MINUTES = 60;

function toDateOnly(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function toISODateTime(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm:ss");
}

export function DashboardCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [calendarData, setCalendarData] = useState<{
    events: CalendarItem[];
    tasks: CalendarItem[];
  }>({ events: [], tasks: [] });
  const [todayTasks, setTodayTasks] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayTasksLoading, setTodayTasksLoading] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [createTaskSlot, setCreateTaskSlot] = useState<Date | null>(null);
  const [showCreateEvent, setShowCreateEvent] = useState(false);

  const {
    projects,
    loadProjects,
    createTask,
  } = useTasksStore();

  const fromParam = useMemo(
    () => format(startOfMonth(currentMonth), "yyyy-MM-dd"),
    [currentMonth]
  );
  const toParam = useMemo(
    () => format(endOfMonth(currentMonth), "yyyy-MM-dd"),
    [currentMonth]
  );

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ events: CalendarItem[]; tasks: CalendarItem[] }>(
        `/portal/calendar?from_d=${fromParam}&to_d=${toParam}`
      );
      setCalendarData(data);
    } catch (e) {
      console.error("Calendar fetch error:", e);
      setCalendarData({ events: [], tasks: [] });
    } finally {
      setLoading(false);
    }
  }, [fromParam, toParam]);

  const fetchTodayTasks = useCallback(async (date: Date) => {
    setTodayTasksLoading(true);
    try {
      const list = await apiGet<CalendarItem[]>(
        `/portal/calendar/today-tasks?date_str=${toDateOnly(date)}`
      );
      setTodayTasks(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error("Today tasks fetch error:", e);
      setTodayTasks([]);
    } finally {
      setTodayTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  useEffect(() => {
    fetchTodayTasks(selectedDate);
  }, [selectedDate, fetchTodayTasks]);

  useEffect(() => {
    if (projects.length === 0) loadProjects();
  }, [loadProjects, projects.length]);

  const allItems = useMemo(
    () => [...calendarData.events, ...calendarData.tasks],
    [calendarData]
  );

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of allItems) {
      const start = item.start_at ? parseISO(item.start_at) : null;
      if (!start) continue;
      const key = toDateOnly(start);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [allItems]);

  const dayViewItems = useMemo(() => {
    const key = toDateOnly(selectedDate);
    return itemsByDay.get(key) ?? [];
  }, [selectedDate, itemsByDay]);

  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    for (let h = DAY_START_HOUR; h < DAY_END_HOUR; h++) {
      slots.push(setMinutes(setHours(selectedDate, h), 0));
    }
    return slots;
  }, [selectedDate]);

  const getItemsInSlot = useCallback(
    (slotStart: Date) => {
      const slotEnd = setMinutes(
        setHours(slotStart, getHours(slotStart) + 1),
        getMinutes(slotStart)
      );
      return dayViewItems.filter((item) => {
        const start = item.start_at ? parseISO(item.start_at) : null;
        if (!start) return false;
        return isWithinInterval(start, { start: slotStart, end: slotEnd });
      });
    },
    [dayViewItems]
  );

  const handlePrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const handleNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));
  const handleSelectDay = (d: Date) => {
    setSelectedDate(d);
    setViewMode("day");
  };
  const handleBackToMonth = () => setViewMode("month");

  const handleSlotClick = (slotStart: Date) => {
    setCreateTaskSlot(slotStart);
    setShowCreateTask(true);
  };

  const handleCreateTaskFromCalendar = () => {
    setCreateTaskSlot(selectedDate);
    setShowCreateTask(true);
  };

  const firstProject = projects.filter((p) => !p.is_archived)[0];

  return (
    <div className="space-y-4">
      <div className="portal-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-500 font-medium">Общий календарь</h3>
          <div className="flex gap-1">
            {viewMode === "day" && (
              <button
                type="button"
                onClick={handleBackToMonth}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600"
                title="Назад к месяцу"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCreateEvent(true)}
              className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200"
              title="Создать событие"
            >
              <CalendarPlus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCreateTaskFromCalendar}
              className="w-8 h-8 rounded-full bg-brand-green text-white flex items-center justify-center hover:opacity-90"
              title="Создать задачу"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {viewMode === "month" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-800 font-medium">
                {format(currentMonth, "LLLL yyyy", { locale: ru })}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="w-8 h-8 rounded-full bg-brand-green text-white flex items-center justify-center hover:opacity-90"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="w-8 h-8 rounded-full bg-brand-green text-white flex items-center justify-center hover:opacity-90"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center text-sm mb-2">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="text-gray-400">
                  {label}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-sm py-8 text-gray-400">
                Загрузка…
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-y-2 gap-x-1 text-center text-sm">
                {monthDays.map((day) => {
                  const key = toDateOnly(day);
                  const items = itemsByDay.get(key) ?? [];
                  const isCurrent = isSameMonth(day, currentMonth);
                  const isSelected = isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <button
                      key={day.getTime()}
                      type="button"
                      onClick={() => handleSelectDay(day)}
                      className={`
                        rounded-full py-1.5 min-w-[32px] transition-colors
                        ${!isCurrent ? "text-gray-300" : "text-gray-700 hover:bg-gray-100"}
                        ${isSelected ? "bg-brand-green text-white hover:bg-brand-green/90" : ""}
                        ${isToday && !isSelected ? "font-semibold text-brand-green" : ""}
                      `}
                    >
                      <span>{format(day, "d")}</span>
                      {items.length > 0 && (
                        <span className="block w-1 h-1 rounded-full bg-current mx-auto mt-0.5 opacity-70" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {viewMode === "day" && (
          <DayView
            selectedDate={selectedDate}
            dayViewItems={dayViewItems}
            timeSlots={timeSlots}
            onSlotClick={handleSlotClick}
            getItemsInSlot={getItemsInSlot}
          />
        )}
      </div>

      {/* Задачи на выбранный день */}
      <div className="portal-card">
        <h3 className="text-gray-500 font-medium mb-3 flex items-center gap-2">
          <ListTodo className="w-4 h-4" />
          {isSameDay(selectedDate, new Date())
            ? "Задачи на сегодня"
            : `Задачи на ${format(selectedDate, "d MMMM", { locale: ru })}`}
        </h3>
        {todayTasksLoading ? (
          <p className="text-sm text-gray-400">Загрузка…</p>
        ) : todayTasks.length === 0 ? (
          <p className="text-sm text-gray-400">Нет задач на этот день</p>
        ) : (
          <ul className="space-y-2">
            {todayTasks.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor:
                      item.type === "event" ? item.color ?? "#3B82F6" : "#22c55e",
                  }}
                />
                <span className="truncate flex-1">{item.title}</span>
                {item.start_at && (
                  <span className="text-gray-400 flex-shrink-0">
                    {format(parseISO(item.start_at), "HH:mm")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreateTask && (
        <CreateTaskModal
          initialDateTime={createTaskSlot ?? selectedDate}
          projects={projects.filter((p) => !p.is_archived)}
          onClose={() => {
            setShowCreateTask(false);
            setCreateTaskSlot(null);
          }}
          onCreate={async (data) => {
            await createTask(data);
            setShowCreateTask(false);
            setCreateTaskSlot(null);
            fetchCalendar();
            fetchTodayTasks(selectedDate);
          }}
        />
      )}

      {showCreateEvent && (
        <CreateEventModal
          initialDate={selectedDate}
          onClose={() => setShowCreateEvent(false)}
          onCreate={() => {
            setShowCreateEvent(false);
            fetchCalendar();
            fetchTodayTasks(selectedDate);
          }}
        />
      )}
    </div>
  );
}

function DayView({
  selectedDate,
  dayViewItems,
  timeSlots,
  onSlotClick,
  getItemsInSlot,
}: {
  selectedDate: Date;
  dayViewItems: CalendarItem[];
  timeSlots: Date[];
  onSlotClick: (slot: Date) => void;
  getItemsInSlot: (slot: Date) => CalendarItem[];
}) {
  return (
    <div className="border-t border-gray-100 pt-4">
      <p className="text-sm font-medium text-gray-700 mb-3">
        {format(selectedDate, "EEEE, d MMMM yyyy", { locale: ru })}
      </p>
      <div className="max-h-[320px] overflow-y-auto space-y-0">
        {timeSlots.map((slot) => {
          const items = getItemsInSlot(slot);
          return (
            <div
              key={slot.getTime()}
              className="flex border-b border-gray-50 min-h-[44px]"
            >
              <div className="w-14 flex-shrink-0 text-xs text-gray-400 py-1 pr-2 text-right">
                {format(slot, "HH:mm")}
              </div>
              <button
                type="button"
                className="flex-1 min-h-[44px] text-left hover:bg-gray-50/80 rounded px-2 py-1 transition-colors"
                onClick={() => onSlotClick(slot)}
              >
                {items.length > 0 ? (
                  <div className="space-y-1">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="text-xs rounded px-2 py-1 truncate border-l-2"
                        style={{
                          borderLeftColor:
                            item.type === "event"
                              ? item.color ?? "#3B82F6"
                              : "#22c55e",
                          backgroundColor:
                            item.type === "event"
                              ? `${item.color ?? "#3B82F6"}20`
                              : "#22c55e20",
                        }}
                        title={item.title}
                      >
                        {format(parseISO(item.start_at!), "HH:mm")} — {item.title}
                      </div>
                    ))}
                  </div>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CreateTaskModal({
  initialDateTime,
  projects,
  onClose,
  onCreate,
}: {
  initialDateTime: Date;
  projects: Project[];
  onClose: () => void;
  onCreate: (data: {
    project_id: string;
    title: string;
    due_date?: string;
    start_date?: string;
    status?: string;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [dateStr, setDateStr] = useState(() =>
    format(initialDateTime, "yyyy-MM-dd")
  );
  const [timeStr, setTimeStr] = useState(() =>
    format(initialDateTime, "HH:mm")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projects.length && !projectId) setProjectId(projects[0].id);
  }, [projects, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) {
      setError("Укажите название и проект");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const dateTime = new Date(`${dateStr}T${timeStr}:00`);
      await onCreate({
        project_id: projectId,
        title: title.trim(),
        due_date: dateTime.toISOString(),
        start_date: dateTime.toISOString(),
        status: "todo",
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="portal-card max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-800 font-medium">Новая задача</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Название
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              placeholder="Название задачи"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Проект
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
            >
              <option value="">Выберите проект</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Дата
              </label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Время
              </label>
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 rounded-lg bg-brand-green text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Создание…" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateEventModal({
  initialDate,
  onClose,
  onCreate,
}: {
  initialDate: Date;
  onClose: () => void;
  onCreate: () => void;
}) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(() =>
    format(initialDate, "yyyy-MM-dd")
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Укажите название");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiPost("/portal/calendar/events", {
        title: title.trim(),
        start_at: `${startDate}T${startTime}:00`,
        end_at: `${startDate}T${endTime}:00`,
        is_all_day: false,
      });
      onCreate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="portal-card max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-gray-800 font-medium">Новое событие</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Название
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              placeholder="Название события"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Дата
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Начало
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Конец
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 rounded-lg bg-brand-green text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Создание…" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
