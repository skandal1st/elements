import { useEffect, useState } from "react";

import { apiFetch } from "../api/client";

type BirthdayEntry = {
  id: number;
  full_name: string;
  department_id?: number;
  birthday?: string;
};

export function Birthdays() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [items, setItems] = useState<BirthdayEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await apiFetch<BirthdayEntry[]>(`/birthdays/?month=${month}`);
      setItems(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    load();
  }, [month]);

  const formatBirthday = (value?: string) => {
    if (!value) {
      return "нет даты";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const day = String(date.getDate()).padStart(2, "0");
    const monthValue = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const now = new Date();
    let age = now.getFullYear() - year;
    const hasBirthdayPassed =
      now.getMonth() > date.getMonth() ||
      (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());
    if (!hasBirthdayPassed) {
      age -= 1;
    }
    return `${day}.${monthValue}.${year} (${age} лет)`;
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Дни рождения</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Календарь сотрудников по месяцам.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-300">Месяц:</label>
        <select
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
          value={month}
          onChange={(event) => setMonth(Number(event.target.value))}
        >
          {[
            "Январь",
            "Февраль",
            "Март",
            "Апрель",
            "Май",
            "Июнь",
            "Июль",
            "Август",
            "Сентябрь",
            "Октябрь",
            "Ноябрь",
            "Декабрь",
          ].map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="text-sm">
              <span className="font-medium text-gray-900 dark:text-white">{item.full_name}</span>{" "}
              — {formatBirthday(item.birthday)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
