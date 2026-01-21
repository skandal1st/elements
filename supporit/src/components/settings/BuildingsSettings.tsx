import { useState, useEffect } from "react";
import {
  Plus,
  Edit,
  Trash2,
  Building2,
  CheckCircle,
  XCircle,
  DoorOpen,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { buildingsService } from "../../services/buildings.service";
import type { Building, Room } from "../../types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import {
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "../ui/Table";

export const BuildingsSettings = () => {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Состояния для кабинетов
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(
    new Set(),
  );
  const [roomsByBuilding, setRoomsByBuilding] = useState<
    Record<string, Room[]>
  >({});
  const [roomsLoading, setRoomsLoading] = useState<Record<string, boolean>>({});
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null,
  );
  const [roomFormLoading, setRoomFormLoading] = useState(false);

  // Форма здания
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    description: "",
    is_active: true,
  });

  // Форма кабинета
  const [roomFormData, setRoomFormData] = useState({
    name: "",
    floor: "",
    description: "",
    is_active: true,
  });

  const loadBuildings = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await buildingsService.getBuildings();
      if (result.error) {
        setError(result.error.message);
      } else {
        setBuildings(result.data);
      }
    } catch (err) {
      setError("Произошла ошибка при загрузке зданий");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuildings();
  }, []);

  // Функции для работы с кабинетами
  const loadRooms = async (buildingId: string) => {
    setRoomsLoading((prev) => ({ ...prev, [buildingId]: true }));
    try {
      const result = await buildingsService.getRooms(buildingId);
      if (!result.error) {
        setRoomsByBuilding((prev) => ({ ...prev, [buildingId]: result.data }));
      }
    } finally {
      setRoomsLoading((prev) => ({ ...prev, [buildingId]: false }));
    }
  };

  const toggleBuildingExpand = async (buildingId: string) => {
    const newExpanded = new Set(expandedBuildings);
    if (newExpanded.has(buildingId)) {
      newExpanded.delete(buildingId);
    } else {
      newExpanded.add(buildingId);
      if (!roomsByBuilding[buildingId]) {
        await loadRooms(buildingId);
      }
    }
    setExpandedBuildings(newExpanded);
  };

  const handleCreateRoom = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    setEditingRoom(null);
    setRoomFormData({ name: "", floor: "", description: "", is_active: true });
    setIsRoomModalOpen(true);
  };

  const handleEditRoom = (room: Room) => {
    setSelectedBuildingId(room.building_id);
    setEditingRoom(room);
    setRoomFormData({
      name: room.name,
      floor: room.floor?.toString() || "",
      description: room.description || "",
      is_active: room.is_active,
    });
    setIsRoomModalOpen(true);
  };

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBuildingId) return;

    setRoomFormLoading(true);
    setError(null);

    try {
      const roomData = {
        name: roomFormData.name,
        floor: roomFormData.floor ? parseInt(roomFormData.floor) : undefined,
        description: roomFormData.description || undefined,
        is_active: roomFormData.is_active,
      };

      if (editingRoom) {
        const result = await buildingsService.updateRoom(
          selectedBuildingId,
          editingRoom.id,
          roomData,
        );
        if (result.error) {
          setError(result.error.message);
          return;
        }
      } else {
        const result = await buildingsService.createRoom(
          selectedBuildingId,
          roomData,
        );
        if (result.error) {
          setError(result.error.message);
          return;
        }
      }

      setIsRoomModalOpen(false);
      loadRooms(selectedBuildingId);
    } finally {
      setRoomFormLoading(false);
    }
  };

  const handleDeleteRoom = async (room: Room) => {
    if (!confirm(`Вы уверены, что хотите удалить кабинет "${room.name}"?`)) {
      return;
    }

    const result = await buildingsService.deleteRoom(room.building_id, room.id);
    if (result.error) {
      setError(result.error.message);
    } else {
      loadRooms(room.building_id);
    }
  };

  const handleCreate = () => {
    setEditingBuilding(null);
    setFormData({ name: "", address: "", description: "", is_active: true });
    setIsModalOpen(true);
  };

  const handleEdit = (building: Building) => {
    setEditingBuilding(building);
    setFormData({
      name: building.name,
      address: building.address || "",
      description: building.description || "",
      is_active: building.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setError(null);

    try {
      if (editingBuilding) {
        const result = await buildingsService.updateBuilding(
          editingBuilding.id,
          formData,
        );
        if (result.error) {
          setError(result.error.message);
          return;
        }
      } else {
        const result = await buildingsService.createBuilding(formData);
        if (result.error) {
          setError(result.error.message);
          return;
        }
      }

      setIsModalOpen(false);
      loadBuildings();
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (building: Building) => {
    if (!confirm(`Вы уверены, что хотите удалить здание "${building.name}"?`)) {
      return;
    }

    const result = await buildingsService.deleteBuilding(building.id);
    if (result.error) {
      setError(result.error.message);
    } else {
      loadBuildings();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
            <Building2 className="h-6 w-6 mr-2" />
            Здания
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Управление списком зданий организации
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-5 w-5 mr-2" />
          Добавить здание
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : buildings.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
          Здания не найдены
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableHeaderCell>{""}</TableHeaderCell>
              <TableHeaderCell>Название</TableHeaderCell>
              <TableHeaderCell>Адрес</TableHeaderCell>
              <TableHeaderCell>Описание</TableHeaderCell>
              <TableHeaderCell>Статус</TableHeaderCell>
              <TableHeaderCell>Действия</TableHeaderCell>
            </TableHeader>
            <TableBody>
              {buildings.map((building) => (
                <>
                  <TableRow key={building.id}>
                    <TableCell>
                      <button
                        onClick={() => toggleBuildingExpand(building.id)}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Показать кабинеты"
                      >
                        {expandedBuildings.has(building.id) ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{building.name}</div>
                    </TableCell>
                    <TableCell>
                      {building.address || (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {building.description || (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {building.is_active ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Активно
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          <XCircle className="h-3 w-3 mr-1" />
                          Неактивно
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleCreateRoom(building.id)}
                          className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                          title="Добавить кабинет"
                        >
                          <DoorOpen className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(building)}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Редактировать"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(building)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Удалить"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedBuildings.has(building.id) && (
                    <tr>
                      <td colSpan={6} className="px-0 py-0">
                        <div className="bg-gray-50 dark:bg-gray-900 border-t border-b border-gray-200 dark:border-gray-700">
                          {roomsLoading[building.id] ? (
                            <div className="flex items-center justify-center py-4">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                            </div>
                          ) : (roomsByBuilding[building.id]?.length || 0) ===
                            0 ? (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                              Кабинеты не найдены.
                              <button
                                onClick={() => handleCreateRoom(building.id)}
                                className="ml-2 text-primary-600 hover:text-primary-700 underline"
                              >
                                Добавить первый
                              </button>
                            </div>
                          ) : (
                            <table className="w-full">
                              <thead>
                                <tr className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  <th className="pl-12 pr-4 py-2">Кабинет</th>
                                  <th className="px-4 py-2">Этаж</th>
                                  <th className="px-4 py-2">Описание</th>
                                  <th className="px-4 py-2">Статус</th>
                                  <th className="px-4 py-2">Действия</th>
                                </tr>
                              </thead>
                              <tbody>
                                {roomsByBuilding[building.id]?.map((room) => (
                                  <tr
                                    key={room.id}
                                    className="border-t border-gray-200 dark:border-gray-700"
                                  >
                                    <td className="pl-12 pr-4 py-2">
                                      <div className="flex items-center">
                                        <DoorOpen className="h-4 w-4 text-gray-400 mr-2" />
                                        <span className="font-medium text-gray-900 dark:text-gray-100">
                                          {room.name}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                      {room.floor || (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                      {room.description || (
                                        <span className="text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2">
                                      {room.is_active ? (
                                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                          Активен
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                          Неактивен
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center space-x-1">
                                        <button
                                          onClick={() => handleEditRoom(room)}
                                          className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                          title="Редактировать"
                                        >
                                          <Edit className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteRoom(room)}
                                          className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                          title="Удалить"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingBuilding
            ? `Редактировать здание: ${editingBuilding.name}`
            : "Добавить здание"
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Название <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Адрес
            </label>
            <input
              id="address"
              type="text"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Описание
            </label>
            <textarea
              id="description"
              rows={3}
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center">
            <input
              id="is_active"
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label
              htmlFor="is_active"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              Активно
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              onClick={() => setIsModalOpen(false)}
              variant="secondary"
            >
              Отмена
            </Button>
            <Button type="submit" loading={formLoading}>
              {editingBuilding ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Модальное окно для кабинетов */}
      <Modal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        title={
          editingRoom
            ? `Редактировать кабинет: ${editingRoom.name}`
            : "Добавить кабинет"
        }
      >
        <form onSubmit={handleRoomSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="room_name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Название кабинета <span className="text-red-500">*</span>
            </label>
            <input
              id="room_name"
              type="text"
              required
              placeholder="Например: 101, А-205, Серверная"
              value={roomFormData.name}
              onChange={(e) =>
                setRoomFormData({ ...roomFormData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="room_floor"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Этаж
            </label>
            <input
              id="room_floor"
              type="number"
              value={roomFormData.floor}
              onChange={(e) =>
                setRoomFormData({ ...roomFormData, floor: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="room_description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Описание
            </label>
            <textarea
              id="room_description"
              rows={2}
              value={roomFormData.description}
              onChange={(e) =>
                setRoomFormData({
                  ...roomFormData,
                  description: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center">
            <input
              id="room_is_active"
              type="checkbox"
              checked={roomFormData.is_active}
              onChange={(e) =>
                setRoomFormData({
                  ...roomFormData,
                  is_active: e.target.checked,
                })
              }
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label
              htmlFor="room_is_active"
              className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
            >
              Активен
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              onClick={() => setIsRoomModalOpen(false)}
              variant="secondary"
            >
              Отмена
            </Button>
            <Button type="submit" loading={roomFormLoading}>
              {editingRoom ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
