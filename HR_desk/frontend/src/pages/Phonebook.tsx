import { useEffect, useState } from "react";

import { apiFetch } from "../api/client";

type PhonebookEntry = {
  id: number;
  full_name: string;
  internal_phone?: string;
  external_phone?: string;
  email?: string;
  department_id?: number;
  position_id?: number;
};

type Department = {
  id: number;
  name: string;
};

type Position = {
  id: number;
  name: string;
};

export function Phonebook() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PhonebookEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [data, departmentData, positionData] = await Promise.all([
        apiFetch<PhonebookEntry[]>(`/phonebook/?q=${encodeURIComponent(query)}`),
        apiFetch<Department[]>("/departments/"),
        apiFetch<Position[]>("/positions/"),
      ]);
      const departmentMap = new Map(departmentData.map((dept) => [dept.id, dept.name]));
      const sorted = [...data].sort((a, b) => {
        const left = departmentMap.get(a.department_id ?? -1) || "";
        const right = departmentMap.get(b.department_id ?? -1) || "";
        return left.localeCompare(right, "ru");
      });
      setItems(sorted);
      setDepartments(departmentData);
      setPositions(positionData);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Телефонная книга</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Поиск по сотрудникам и контактам.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск по ФИО"
        />
        <button
          onClick={load}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
        >
          Найти
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <table>
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Отдел</th>
              <th>Должность</th>
              <th>Внутренний</th>
              <th>Внешний</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.full_name}</td>
                <td>{departments.find((dept) => dept.id === item.department_id)?.name || "-"}</td>
                <td>{positions.find((pos) => pos.id === item.position_id)?.name || "-"}</td>
                <td>{item.internal_phone || "-"}</td>
                <td>{item.external_phone || "-"}</td>
                <td>{item.email || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
