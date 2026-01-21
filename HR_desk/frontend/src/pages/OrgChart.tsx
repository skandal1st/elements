import { useEffect, useState } from "react";

import { apiFetch } from "../api/client";

type OrgEmployee = {
  id: number;
  full_name: string;
  department_id?: number;
  position_id?: number;
  internal_phone?: string;
  external_phone?: string;
  email?: string;
};

type OrgPosition = {
  id?: number;
  name: string;
  employees: OrgEmployee[];
};

type OrgDepartment = {
  id: number;
  name: string;
  parent_department_id?: number;
  positions: OrgPosition[];
};

type Department = {
  id: number;
  name: string;
  parent_department_id?: number;
  manager_id?: number;
};

type Position = {
  id: number;
  name: string;
  department_id?: number;
};

export function OrgChart() {
  const [items, setItems] = useState<OrgDepartment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<OrgEmployee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [newDepartment, setNewDepartment] = useState({
    name: "",
    parent_department_id: "",
    manager_id: "",
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptForm, setDeptForm] = useState({
    name: "",
    parent_department_id: "",
    manager_id: "",
  });
  const [editing, setEditing] = useState<OrgEmployee | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    department_id: "",
    position_id: "",
    manager_id: "",
    internal_phone: "",
    external_phone: "",
    email: "",
  });
  const [error, setError] = useState<string | null>(null);

  const loadReferenceData = async () => {
    const [orgData, departmentData, employeeData, positionData, user] =
      await Promise.all([
        apiFetch<OrgDepartment[]>("/org/"),
        apiFetch<Department[]>("/departments/"),
        apiFetch<OrgEmployee[]>("/employees/"),
        apiFetch<Position[]>("/positions/"),
        apiFetch<{ role: string }>("/auth/me"),
      ]);
    setItems(orgData);
    setDepartments(departmentData);
    setEmployees(employeeData);
    setPositions(positionData);
    setRole(user.role);
  };

  useEffect(() => {
    loadReferenceData().catch((err) => setError((err as Error).message));
  }, []);

  const handleCreateDepartment = async () => {
    try {
      await apiFetch("/departments/", {
        method: "POST",
        body: JSON.stringify({
          name: newDepartment.name,
          parent_department_id: newDepartment.parent_department_id
            ? Number(newDepartment.parent_department_id)
            : undefined,
          manager_id: newDepartment.manager_id
            ? Number(newDepartment.manager_id)
            : undefined,
        }),
      });
      setNewDepartment({ name: "", parent_department_id: "", manager_id: "" });
      await loadReferenceData();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openDeptEdit = (dept: Department) => {
    setEditingDept(dept);
    setDeptForm({
      name: dept.name,
      parent_department_id: dept.parent_department_id
        ? String(dept.parent_department_id)
        : "",
      manager_id: dept.manager_id ? String(dept.manager_id) : "",
    });
    setIsDeptModalOpen(true);
  };

  const handleSaveDept = async () => {
    if (!editingDept) return;
    try {
      const payload: Record<string, unknown> = {};
      if (deptForm.name && deptForm.name !== editingDept.name) {
        payload.name = deptForm.name;
      }
      const parentId = deptForm.parent_department_id
        ? Number(deptForm.parent_department_id)
        : null;
      if (parentId !== editingDept.parent_department_id) {
        payload.parent_department_id = parentId;
      }
      const managerId = deptForm.manager_id
        ? Number(deptForm.manager_id)
        : null;
      if (managerId !== editingDept.manager_id) {
        payload.manager_id = managerId;
      }
      if (Object.keys(payload).length > 0) {
        await apiFetch(`/departments/${editingDept.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      setIsDeptModalOpen(false);
      setEditingDept(null);
      setDeptForm({ name: "", parent_department_id: "", manager_id: "" });
      await loadReferenceData();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteDept = async (deptId: number) => {
    if (!window.confirm("Вы уверены, что хотите удалить этот отдел?")) return;
    try {
      await apiFetch(`/departments/${deptId}`, { method: "DELETE" });
      await loadReferenceData();
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const openEdit = (item: OrgEmployee) => {
    setEditing(item);
    setForm({
      full_name: item.full_name,
      department_id: item.department_id ? String(item.department_id) : "",
      position_id: item.position_id ? String(item.position_id) : "",
      manager_id: "",
      internal_phone: item.internal_phone || "",
      external_phone: item.external_phone || "",
      email: item.email || "",
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!editing) {
      return;
    }
    try {
      const payload: Record<string, unknown> = {};
      if (form.full_name && form.full_name !== editing.full_name) {
        payload.full_name = form.full_name;
      }
      const departmentId = form.department_id
        ? Number(form.department_id)
        : null;
      if (departmentId !== editing.department_id) {
        payload.department_id = departmentId;
      }
      const positionId = form.position_id ? Number(form.position_id) : null;
      if (positionId !== editing.position_id) {
        payload.position_id = positionId;
      }
      if (form.manager_id) {
        payload.manager_id = Number(form.manager_id);
      }
      if (form.internal_phone !== (editing.internal_phone || "")) {
        payload.internal_phone = form.internal_phone || null;
      }
      if (form.external_phone !== (editing.external_phone || "")) {
        payload.external_phone = form.external_phone || null;
      }
      if (form.email !== (editing.email || "")) {
        payload.email = form.email || null;
      }
      if (Object.keys(payload).length > 0) {
        await apiFetch(`/employees/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
      setIsModalOpen(false);
      setEditing(null);
      setForm({
        full_name: "",
        department_id: "",
        position_id: "",
        manager_id: "",
        internal_phone: "",
        external_phone: "",
        email: "",
      });
      await loadReferenceData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Оргструктура
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Дерево отделов, должностей и сотрудников.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {role === "admin" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Справочник отделов
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              placeholder="Название отдела"
              value={newDepartment.name}
              onChange={(event) =>
                setNewDepartment((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
            />
            <select
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              value={newDepartment.parent_department_id}
              onChange={(event) =>
                setNewDepartment((prev) => ({
                  ...prev,
                  parent_department_id: event.target.value,
                }))
              }
            >
              <option value="">Родительский отдел</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            <select
              className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              value={newDepartment.manager_id}
              onChange={(event) =>
                setNewDepartment((prev) => ({
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
          </div>
          <button
            onClick={handleCreateDepartment}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
            disabled={!newDepartment.name}
          >
            Добавить отдел
          </button>
        </div>
      )}
      <div className="space-y-4">
        {items.map((department) => (
          <div
            key={department.id}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {department.name}
                {department.parent_department_id && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    (подчинен:{" "}
                    {
                      departments.find(
                        (d) => d.id === department.parent_department_id,
                      )?.name
                    }
                    )
                  </span>
                )}
              </h3>
              {role === "admin" && (
                <div className="flex gap-2">
                  <button
                    className="text-xs text-primary-600 hover:text-primary-700"
                    onClick={() => openDeptEdit(department)}
                  >
                    Редактировать
                  </button>
                  <button
                    className="text-xs text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteDept(department.id)}
                  >
                    Удалить
                  </button>
                </div>
              )}
            </div>
            <div className="mt-3 space-y-3">
              {department.positions.map((position) => (
                <div
                  key={position.id ?? position.name}
                  className="pl-4 border-l border-gray-200 dark:border-gray-700"
                >
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {position.name}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {position.employees.map((employee) => (
                      <li
                        key={employee.id}
                        className="text-sm text-gray-600 dark:text-gray-300"
                      >
                        <div className="flex items-center justify-between">
                          <span>{employee.full_name}</span>
                          <button
                            className="text-xs text-primary-600 hover:text-primary-700"
                            onClick={() => openEdit(employee)}
                          >
                            Редактировать
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}

        {employees.filter((employee) => !employee.department_id).length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Без отдела
            </h3>
            <ul className="mt-3 space-y-2">
              {employees
                .filter((employee) => !employee.department_id)
                .map((employee) => (
                  <li
                    key={employee.id}
                    className="text-sm text-gray-600 dark:text-gray-300"
                  >
                    <div className="flex items-center justify-between">
                      <span>{employee.full_name}</span>
                      <button
                        className="text-xs text-primary-600 hover:text-primary-700"
                        onClick={() => openEdit(employee)}
                      >
                        Редактировать
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Редактирование сотрудника
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
                value={form.full_name}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    full_name: event.target.value,
                  }))
                }
              />
              <select
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                value={form.department_id}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    department_id: event.target.value,
                  }))
                }
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
                value={form.position_id}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    position_id: event.target.value,
                  }))
                }
              >
                <option value="">Должность</option>
                {positions
                  .filter(
                    (pos) =>
                      !form.department_id ||
                      pos.department_id === Number(form.department_id),
                  )
                  .map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="px-3 py-2 text-sm font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50"
                onClick={async () => {
                  if (!form.department_id) {
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
                      department_id: Number(form.department_id),
                    }),
                  });
                  setPositions((prev) => [...prev, created]);
                  setForm((prev) => ({
                    ...prev,
                    position_id: String(created.id),
                  }));
                }}
              >
                Добавить должность
              </button>
              <select
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                value={form.manager_id}
                onChange={(event) =>
                  setForm((prev) => ({
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
                value={form.internal_phone}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    internal_phone: event.target.value,
                  }))
                }
              />
              <input
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                placeholder="Внешний телефон"
                value={form.external_phone}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    external_phone: event.target.value,
                  }))
                }
              />
              <input
                className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                placeholder="Email"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    department_id: "",
                    position_id: "",
                    manager_id: "",
                    internal_phone: "",
                    external_phone: "",
                    email: "",
                  }))
                }
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Очистить поля
              </button>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
                disabled={!form.full_name}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Редактирование отдела
              </h3>
              <button
                onClick={() => setIsDeptModalOpen(false)}
                className="text-sm text-gray-500"
              >
                Закрыть
              </button>
            </div>

            <div className="space-y-3">
              <input
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                placeholder="Название отдела"
                value={deptForm.name}
                onChange={(e) =>
                  setDeptForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                value={deptForm.parent_department_id}
                onChange={(e) =>
                  setDeptForm((prev) => ({
                    ...prev,
                    parent_department_id: e.target.value,
                  }))
                }
              >
                <option value="">Без родительского отдела</option>
                {departments
                  .filter((d) => d.id !== editingDept?.id)
                  .map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
              </select>
              <select
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                value={deptForm.manager_id}
                onChange={(e) =>
                  setDeptForm((prev) => ({
                    ...prev,
                    manager_id: e.target.value,
                  }))
                }
              >
                <option value="">Без руководителя</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsDeptModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Отмена
              </button>
              <button
                onClick={handleSaveDept}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
                disabled={!deptForm.name}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
