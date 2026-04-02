import { Markup } from "telegraf";
import type { TicketStatus } from "../types.js";

export const mainMenuKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("📋 Активные заявки", "tickets_list")],
  [Markup.button.callback("🔍 Мои заявки", "my_tickets")],
  [Markup.button.callback("⚙️ Настройки", "settings")],
]);

export const ticketsFilterKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback("Все", "tickets_filter_all"),
    Markup.button.callback("🔵 Новые", "tickets_filter_new"),
  ],
  [
    Markup.button.callback("🟡 В работе", "tickets_filter_in_progress"),
    Markup.button.callback("🟠 Ожидание", "tickets_filter_waiting"),
  ],
  [Markup.button.callback("« Назад", "main_menu")],
]);

export function ticketActionsKeyboard(
  ticketId: string,
  currentStatus: TicketStatus,
) {
  const buttons = [];
  // Используем короткий ID (первые 8 символов) для callback_data (лимит 64 байта)
  const shortId = ticketId.slice(0, 8);

  // Кнопка "Взять в работу" только для новых заявок
  if (currentStatus === "new") {
    buttons.push([
      Markup.button.callback("✅ Взять в работу", `t_take_${shortId}`),
    ]);
  }

  // Кнопки изменения статуса
  if (currentStatus !== "closed" && currentStatus !== "resolved") {
    buttons.push([
      Markup.button.callback("📊 Изменить статус", `t_status_${shortId}`),
    ]);
  }

  // Кнопка комментария
  buttons.push([
    Markup.button.callback("💬 Добавить комментарий", `t_comment_${shortId}`),
  ]);

  // Кнопка назад
  buttons.push([Markup.button.callback("« К списку заявок", "tickets_list")]);

  return Markup.inlineKeyboard(buttons);
}

export function ticketStatusKeyboard(
  ticketId: string,
  currentStatus: TicketStatus,
) {
  const buttons = [];
  // Используем короткий ID (первые 8 символов) для callback_data (лимит 64 байта)
  const shortId = ticketId.slice(0, 8);

  // Сокращённые коды статусов для callback_data
  const statuses: Array<{
    status: TicketStatus;
    code: string;
    label: string;
    emoji: string;
  }> = [
    { status: "new", code: "n", label: "Новая", emoji: "🔵" },
    { status: "in_progress", code: "p", label: "В работе", emoji: "🟡" },
    { status: "waiting", code: "w", label: "Ожидание", emoji: "🟠" },
    { status: "resolved", code: "r", label: "Решена", emoji: "🟢" },
    { status: "closed", code: "c", label: "Закрыта", emoji: "⚫" },
  ];

  for (const s of statuses) {
    if (s.status !== currentStatus) {
      buttons.push([
        Markup.button.callback(
          `${s.emoji} ${s.label}`,
          `t_set_${shortId}_${s.code}`,
        ),
      ]);
    }
  }

  buttons.push([Markup.button.callback("« Назад", `t_view_${shortId}`)]);

  return Markup.inlineKeyboard(buttons);
}

export function ticketListKeyboard(
  tickets: Array<{ id: string; title: string }>,
  filter: string,
) {
  const buttons = tickets.map((t) => {
    const shortId = t.id.slice(0, 8);
    return [
      Markup.button.callback(
        `#${shortId} - ${t.title.slice(0, 30)}${t.title.length > 30 ? "..." : ""}`,
        `t_view_${shortId}`,
      ),
    ];
  });

  buttons.push([
    Markup.button.callback("🔄 Обновить", `tickets_filter_${filter}`),
  ]);
  buttons.push([Markup.button.callback("« Главное меню", "main_menu")]);

  return Markup.inlineKeyboard(buttons);
}

export const settingsKeyboard = (notificationsEnabled: boolean) =>
  Markup.inlineKeyboard([
    [
      Markup.button.callback(
        notificationsEnabled ? "🔔 Уведомления: Вкл" : "🔕 Уведомления: Выкл",
        "toggle_notifications",
      ),
    ],
    [Markup.button.callback("🔗 Отвязать аккаунт", "unlink_account")],
    [Markup.button.callback("« Назад", "main_menu")],
  ]);

export const confirmUnlinkKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback("✅ Да, отвязать", "confirm_unlink"),
    Markup.button.callback("❌ Отмена", "settings"),
  ],
]);

export function equipmentActionsKeyboard(equipmentId: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "📝 Создать заявку",
        `equipment_create_ticket_${equipmentId}`,
      ),
    ],
    [Markup.button.callback("📜 История", `equipment_history_${equipmentId}`)],
  ]);
}

export const cancelKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback("❌ Отмена", "cancel_action")],
]);
