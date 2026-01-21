import { useEffect, useState } from "react";

import { apiFetch } from "../api/client";

type AuditLog = {
  id: number;
  user: string;
  action: string;
  entity: string;
  timestamp: string;
  details?: string;
};

export function Audit() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AuditLog[]>("/audit/")
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Аудит действий</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          История операций и изменений в системе.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <table>
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Действие</th>
              <th>Сущность</th>
              <th>Время</th>
              <th>Детали</th>
            </tr>
          </thead>
          <tbody>
            {items.map((log) => (
              <tr key={log.id}>
                <td>{log.user}</td>
                <td>{log.action}</td>
                <td>{log.entity}</td>
                <td>{new Date(log.timestamp).toLocaleString("ru-RU")}</td>
                <td>{log.details || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
