import { useEffect, useState } from "react";

import { apiFetch } from "../api/client";

type HRRequest = {
  id: number;
  type: string;
  employee_id: number;
  request_date: string;
  effective_date?: string;
  status: string;
  needs_it_equipment: boolean;
  pass_number?: string;
};

type Department = {
  id: number;
  name: string;
  manager_id?: number | null;
};

type Position = {
  id: number;
  name: string;
  department_id?: number;
};

type Employee = {
  id: number;
  full_name: string;
  email?: string;
  department_id?: number;
  manager_id?: number;
};

export function HRPanel() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [hireDate, setHireDate] = useState("");
  const [fireEmployeeId, setFireEmployeeId] = useState("");
  const [fireDate, setFireDate] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    full_name: "",
    department_id: "",
    manager_id: "",
    position_id: "",
    internal_phone: "",
    external_phone: "",
    email: "",
    birthday: "",
    uses_it_equipment: false,
    pass_number: "",
  });

  const loadData = async () => {
    const [departmentData, employeeData, positionData] = await Promise.all([
      apiFetch<Department[]>("/departments/"),
      apiFetch<Employee[]>("/employees/"),
      apiFetch<Position[]>("/positions/"),
    ]);
    setDepartments(departmentData);
    setEmployees(employeeData);
    setPositions(positionData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const createRequest = async (payload: Omit<HRRequest, "id" | "status">) => {
    const data = await apiFetch<HRRequest>("/hr-requests/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setMessage(`Заявка создана #${data.id}`);
  };

  const handleDepartmentChange = (departmentId: string) => {
    const department = departments.find(
      (item) => item.id === Number(departmentId),
    );
    setNewEmployee((prev) => ({
      ...prev,
      department_id: departmentId,
      manager_id: department?.manager_id ? String(department.manager_id) : "",
    }));
  };

  const handleCreateEmployee = async () => {
    setError(null);
    try {
      const positionId = newEmployee.position_id
        ? Number(newEmployee.position_id)
        : undefined;
      const payload = {
        full_name: newEmployee.full_name,
        department_id: newEmployee.department_id
          ? Number(newEmployee.department_id)
          : undefined,
        manager_id: newEmployee.manager_id
          ? Number(newEmployee.manager_id)
          : undefined,
        position_id: positionId,
        internal_phone: newEmployee.internal_phone || undefined,
        external_phone: newEmployee.external_phone || undefined,
        email: newEmployee.email || undefined,
        birthday: newEmployee.birthday || undefined,
        uses_it_equipment: newEmployee.uses_it_equipment,
        pass_number: newEmployee.pass_number || undefined,
      };
      const employee = await apiFetch<Employee>("/employees/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await createRequest({
        type: "hire",
        employee_id: employee.id,
        request_date: new Date().toISOString().slice(0, 10),
        effective_date: hireDate || undefined,
        needs_it_equipment: newEmployee.uses_it_equipment,
        pass_number: newEmployee.pass_number || undefined,
      });
      setIsModalOpen(false);
      setNewEmployee({
        full_name: "",
        department_id: "",
        manager_id: "",
        position_id: "",
        internal_phone: "",
        external_phone: "",
        email: "",
        birthday: "",
        uses_it_equipment: false,
        pass_number: "",
      });
      await loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          HR-панель
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Создание заявок на прием или увольнение.
        </p>
      </div>
      {message && <p className="text-sm text-green-600">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-between items-center">
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
        >
          Добавить сотрудника
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Увольнение сотрудника
        </h3>
        <div className="flex flex-wrap gap-2">
          <select
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
            value={fireEmployeeId}
            onChange={(event) => setFireEmployeeId(event.target.value)}
          >
            <option value="">Выберите сотрудника</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name}
              </option>
            ))}
          </select>
          <input
            className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
            type="date"
            value={fireDate}
            onChange={(event) => setFireDate(event.target.value)}
          />
          <button
            onClick={() =>
              createRequest({
                type: "fire",
                employee_id: Number(fireEmployeeId),
                request_date: new Date().toISOString().slice(0, 10),
                effective_date: fireDate || undefined,
                needs_it_equipment: false,
              })
            }
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
          >
            Уволить
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Новый сотрудник
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-sm text-gray-500"
              >
                Закрыть
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                placeholder="ФИО"
                value={newEmployee.full_name}
                onChange={(event) =>
                  setNewEmployee((prev) => ({
                    ...prev,
                    full_name: event.target.value,
                  }))
                }
              />
              <select
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                value={newEmployee.department_id}
                onChange={(event) => handleDepartmentChange(event.target.value)}
              >
                <option value="">Отдел</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <select
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                value={newEmployee.position_id}
                onChange={(event) =>
                  setNewEmployee((prev) => ({
                    ...prev,
                    position_id: event.target.value,
                  }))
                }
              >
                <option value="">Должность</option>
                {positions
                  .filter(
                    (position) =>
                      !newEmployee.department_id ||
                      position.department_id ===
                        Number(newEmployee.department_id),
                  )
                  .map((position) => (
                    <option key={position.id} value={position.id}>
                      {position.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="px-3 py-2 text-sm font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50"
                onClick={async () => {
                  if (!newEmployee.department_id) {
                    setError("Сначала выберите отдел");
                    return;
                  }
                  const name = window.prompt("Название должности");
                  if (!name) {
                    return;
                  }
                  const created = await apiFetch<Position>("/positions/", {
                    method: "POST",
                    body: JSON.stringify({
                      name: name.trim(),
                      department_id: Number(newEmployee.department_id),
                    }),
                  });
                  setPositions((prev) => [...prev, created]);
                  setNewEmployee((prev) => ({
                    ...prev,
                    position_id: String(created.id),
                  }));
                }}
              >
                Добавить должность
              </button>
              <select
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                value={newEmployee.manager_id}
                onChange={(event) =>
                  setNewEmployee((prev) => ({
                    ...prev,
                    manager_id: event.target.value,
                  }))
                }
              >
                <option value="">Руководитель</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </option>
                ))}
              </select>
              <input
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                placeholder="Внутренний телефон"
                value={newEmployee.internal_phone}
                onChange={(event) =>
                  setNewEmployee((prev) => ({
                    ...prev,
                    internal_phone: event.target.value,
                  }))
                }
              />
              <input
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                placeholder="Внешний телефон"
                value={newEmployee.external_phone}
                onChange={(event) =>
                  setNewEmployee((prev) => ({
                    ...prev,
                    external_phone: event.target.value,
                  }))
                }
              />
              <input
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                placeholder="Email"
                value={newEmployee.email}
                onChange={(event) =>
                  setNewEmployee((prev) => ({
                    ...prev,
                    email: event.target.value,
                  }))
                }
              />
              <input
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                placeholder="Номер пропуска"
                value={newEmployee.pass_number}
                onChange={(event) =>
                  setNewEmployee((prev) => ({
                    ...prev,
                    pass_number: event.target.value,
                  }))
                }
              />
              <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                Дата рождения
                <input
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  type="date"
                  value={newEmployee.birthday}
                  onChange={(event) =>
                    setNewEmployee((prev) => ({
                      ...prev,
                      birthday: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
                Дата выхода на работу
                <input
                  className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                  type="date"
                  value={hireDate}
                  onChange={(event) => setHireDate(event.target.value)}
                />
              </label>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={newEmployee.uses_it_equipment}
                onChange={(event) =>
                  setNewEmployee((prev) => ({
                    ...prev,
                    uses_it_equipment: event.target.checked,
                  }))
                }
              />
              Использует ИТ-оборудование
            </label>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleCreateEmployee}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
                disabled={!newEmployee.full_name}
              >
                Создать
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
