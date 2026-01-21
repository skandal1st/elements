import { Router, Response } from "express";
import { pool } from "../config/database.js";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth.js";
import QRCode from "qrcode";

const router = Router();

// Получить список оборудования
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      category,
      search,
      owner_id,
      department,
      room,
      page = "1",
      pageSize = "20",
    } = req.query;

    let query = "SELECT * FROM equipment WHERE 1=1";
    const params: any[] = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND status = $${paramCount}`;
      params.push(status);
    }

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (owner_id) {
      paramCount++;
      query += ` AND current_owner_id = $${paramCount}`;
      params.push(owner_id);
    }

    if (department) {
      paramCount++;
      query += ` AND location_department = $${paramCount}`;
      params.push(department);
    }

    if (room) {
      paramCount++;
      query += ` AND location_room = $${paramCount}`;
      params.push(room);
    }

    if (search) {
      paramCount++;
      query += ` AND (name ILIKE $${paramCount} OR inventory_number ILIKE $${paramCount} OR serial_number ILIKE $${paramCount})`;
      params.push(`%${search}%`);
    }

    // Подсчет общего количества
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*)");
    const countResult = await pool.query(countQuery, params);
    const totalCount = parseInt(countResult.rows[0].count);

    // Пагинация
    const pageNum = parseInt(page as string);
    const pageSizeNum = parseInt(pageSize as string);
    const offset = (pageNum - 1) * pageSizeNum;

    query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(pageSizeNum, offset);

    const result = await pool.query(query, params);
    const equipment = result.rows;

    // Загружаем владельцев
    const ownerIds = [
      ...new Set(
        equipment.map((item: any) => item.current_owner_id).filter(Boolean),
      ),
    ];
    let ownersMap = new Map();

    if (ownerIds.length > 0) {
      const ownersResult = await pool.query(
        "SELECT id, email, full_name, department FROM users WHERE id = ANY($1)",
        [ownerIds],
      );
      ownersMap = new Map(
        ownersResult.rows.map((owner: any) => [owner.id, owner]),
      );
    }

    // Добавляем информацию о владельцах
    const equipmentWithOwners = equipment.map((item: any) => ({
      ...item,
      current_owner: item.current_owner_id
        ? ownersMap.get(item.current_owner_id) || null
        : null,
    }));

    res.json({
      data: equipmentWithOwners,
      count: totalCount,
    });
  } catch (error) {
    console.error("Ошибка получения оборудования:", error);
    res.status(500).json({ error: "Ошибка при получении оборудования" });
  }
});

// Получить оборудование текущего пользователя
// ВАЖНО: Этот роут должен быть ПЕРЕД роутом /:id
router.get("/my", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;

    const result = await pool.query(
      `SELECT * FROM equipment
       WHERE current_owner_id = $1 AND status != 'written_off'
       ORDER BY name`,
      [userId],
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error("Ошибка получения оборудования пользователя:", error);
    res.status(500).json({ error: "Ошибка при получении оборудования" });
  }
});

// Получить оборудование по местоположению (кабинету)
// ВАЖНО: Этот роут должен быть ПЕРЕД роутом /:id, иначе Express будет интерпретировать "by-location" как UUID
router.get(
  "/by-location",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      console.log("=== Начало запроса оборудования по местоположению ===");
      console.log("URL:", req.url);
      console.log("Query params:", req.query);
      console.log("UserId:", req.userId);

      const { department, room } = req.query;

      console.log("Распарсенные параметры:", {
        department: department ? department.toString() : null,
        room: room ? room.toString() : null,
        departmentType: typeof department,
        roomType: typeof room,
      });

      // Используем прямой запрос вместо функции для получения всех полей
      let query = "SELECT * FROM equipment WHERE status != $1";
      const params: any[] = ["written_off"];
      let paramCount = 1;

      if (department) {
        const deptStr = department.toString();
        if (deptStr.trim()) {
          paramCount++;
          const deptValue = deptStr.trim();
          query += ` AND location_department ILIKE $${paramCount}`;
          params.push(`%${deptValue}%`);
          console.log(`Добавлен фильтр по зданию: "${deptValue}"`);
        }
      }

      if (room) {
        const roomStr = room.toString();
        if (roomStr.trim()) {
          paramCount++;
          const roomValue = roomStr.trim();
          query += ` AND location_room ILIKE $${paramCount}`;
          params.push(`%${roomValue}%`);
          console.log(`Добавлен фильтр по кабинету: "${roomValue}"`);
        }
      }

      query += ` ORDER BY name`;

      console.log("Финальный SQL запрос:", query);
      console.log("Параметры запроса:", params);
      console.log("Количество параметров:", params.length);
      console.log("Pool доступен:", !!pool);
      console.log("Тип pool:", typeof pool);

      if (!pool) {
        throw new Error("Database pool не инициализирован");
      }

      const result = await pool.query(query, params);

      console.log("Найдено оборудования:", result.rows.length);
      if (result.rows.length > 0) {
        console.log("Пример оборудования:", {
          id: result.rows[0].id,
          name: result.rows[0].name,
          department: result.rows[0].location_department,
          room: result.rows[0].location_room,
        });
      }

      console.log("=== Успешное завершение запроса ===");
      res.json({ data: result.rows });
    } catch (error: any) {
      console.error("=== ОШИБКА получения оборудования по местоположению ===");
      console.error("Тип ошибки:", error.constructor.name);
      console.error("Сообщение:", error.message);
      console.error("Код ошибки:", error.code);
      console.error("Детали:", error.detail);
      console.error("Подсказка:", error.hint);
      console.error("Позиция:", error.position);
      console.error("Стек:", error.stack);
      console.error(
        "Полный объект ошибки:",
        JSON.stringify(error, Object.getOwnPropertyNames(error)),
      );

      res.status(500).json({
        error: "Ошибка при получении оборудования",
        message:
          process.env.NODE_ENV === "development" ? error.message : undefined,
        code: error.code,
        detail:
          process.env.NODE_ENV === "development" ? error.detail : undefined,
      });
    }
  },
);

// Получить оборудование по ID
router.get("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await pool.query("SELECT * FROM equipment WHERE id = $1", [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Оборудование не найдено" });
    }

    const equipment = result.rows[0];

    // Загружаем владельца
    let current_owner = null;
    if (equipment.current_owner_id) {
      const ownerResult = await pool.query(
        "SELECT id, email, full_name, department FROM users WHERE id = $1",
        [equipment.current_owner_id],
      );
      if (ownerResult.rows.length > 0) {
        current_owner = ownerResult.rows[0];
      }
    }

    res.json({
      data: {
        ...equipment,
        current_owner,
      },
    });
  } catch (error) {
    console.error("Ошибка получения оборудования:", error);
    res.status(500).json({ error: "Ошибка при получении оборудования" });
  }
});

// Создать оборудование
router.post(
  "/",
  authenticate,
  requireRole("admin", "it_specialist"),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        model,
        inventory_number,
        serial_number,
        category,
        status,
        purchase_date,
        cost,
        warranty_until,
        current_owner_id,
        location_department,
        location_room,
        manufacturer,
        ip_address,
        specifications,
        attachments,
      } = req.body;

      // Валидация обязательных полей
      if (!name || !inventory_number || !category) {
        return res.status(400).json({
          error: "Название, инвентарный номер и категория обязательны",
        });
      }

      // Преобразуем пустые строки в null для опциональных полей
      const cleanValue = (value: any) => {
        if (value === "" || value === undefined) return null;
        return value;
      };

      // Преобразуем cost в число или null
      const cleanCost =
        cost !== null && cost !== undefined && cost !== ""
          ? parseFloat(cost.toString())
          : null;

      // Преобразуем даты: пустые строки в null
      const cleanDate = (date: any) => {
        if (!date || date === "") return null;
        return date;
      };

      // Преобразуем current_owner_id: пустые строки в null
      const cleanOwnerId =
        current_owner_id && current_owner_id !== "" ? current_owner_id : null;

      // Преобразуем specifications
      let cleanSpecifications = null;
      if (specifications) {
        if (typeof specifications === "string") {
          try {
            cleanSpecifications = JSON.parse(specifications);
          } catch {
            cleanSpecifications = null;
          }
        } else if (
          typeof specifications === "object" &&
          Object.keys(specifications).length > 0
        ) {
          cleanSpecifications = specifications;
        }
        // Преобразуем в JSON строку только если есть данные
        if (cleanSpecifications) {
          cleanSpecifications = JSON.stringify(cleanSpecifications);
        }
      }

      const result = await pool.query(
        `INSERT INTO equipment (
        name, model, inventory_number, serial_number, category, status,
        purchase_date, cost, warranty_until, current_owner_id,
        location_department, location_room, manufacturer, ip_address, specifications,
        attachments, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::text[], NOW(), NOW())
      RETURNING *`,
        [
          name,
          cleanValue(model),
          inventory_number,
          cleanValue(serial_number),
          category,
          status || "in_stock",
          cleanDate(purchase_date),
          cleanCost,
          cleanDate(warranty_until),
          cleanOwnerId,
          cleanValue(location_department),
          cleanValue(location_room),
          cleanValue(manufacturer),
          cleanValue(ip_address),
          cleanSpecifications,
          attachments && Array.isArray(attachments) ? attachments : null,
        ],
      );

      const equipment = result.rows[0];

      // Загружаем владельца
      let current_owner = null;
      if (equipment.current_owner_id) {
        const ownerResult = await pool.query(
          "SELECT id, email, full_name, department FROM users WHERE id = $1",
          [equipment.current_owner_id],
        );
        if (ownerResult.rows.length > 0) {
          current_owner = ownerResult.rows[0];
        }
      }

      res.status(201).json({
        data: {
          ...equipment,
          current_owner,
        },
      });
    } catch (error: any) {
      console.error("Ошибка создания оборудования:", error);
      console.error("Детали ошибки:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        stack: error.stack,
      });

      if (error.code === "23505") {
        return res.status(400).json({
          error: "Оборудование с таким инвентарным номером уже существует",
        });
      }

      if (error.code === "23503") {
        return res
          .status(400)
          .json({ error: "Некорректный владелец оборудования" });
      }

      if (error.code === "23514") {
        return res
          .status(400)
          .json({ error: "Некорректное значение для категории или статуса" });
      }

      res.status(500).json({
        error: "Ошибка при создании оборудования",
        message:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

// Обновить оборудование
router.put(
  "/:id",
  authenticate,
  requireRole("admin", "it_specialist"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      console.log("Обновление оборудования:", { id, updates });

      // Вспомогательные функции для очистки данных
      const cleanValue = (value: any) => {
        if (value === "" || value === undefined) return null;
        return value;
      };

      // Список разрешенных полей для обновления
      const allowedFields = [
        "name",
        "model",
        "inventory_number",
        "serial_number",
        "category",
        "status",
        "purchase_date",
        "cost",
        "warranty_until",
        "current_owner_id",
        "location_department",
        "location_room",
        "manufacturer",
        "ip_address",
        "specifications",
        "attachments",
      ];

      // Формируем динамический запрос
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      Object.keys(updates).forEach((key) => {
        // Пропускаем служебные поля и поля, которых нет в таблице
        if (
          key === "id" ||
          key === "created_at" ||
          key === "current_owner" ||
          key === "updated_at" ||
          key === "qr_code"
        ) {
          return;
        }

        // Пропускаем поля, которых нет в списке разрешенных
        if (!allowedFields.includes(key)) {
          console.log(`Пропущено поле ${key} - не в списке разрешенных`);
          return;
        }

        let value = updates[key];

        // Пропускаем undefined значения
        if (value === undefined) {
          console.log(`Пропущено поле ${key} - значение undefined`);
          return;
        }

        // Обработка специфичных полей с явным указанием типов
        if (key === "specifications") {
          // Обрабатываем specifications: null, пустой объект или объект с данными
          if (
            value === null ||
            (typeof value === "object" && Object.keys(value).length === 0)
          ) {
            paramCount++;
            fields.push(`${key} = $${paramCount}::jsonb`);
            values.push(null);
          } else if (value) {
            if (typeof value === "string") {
              try {
                value = JSON.parse(value);
              } catch {
                // Оставляем как есть, если не JSON
              }
            }
            value = JSON.stringify(value);
            paramCount++;
            fields.push(`${key} = $${paramCount}::jsonb`);
            values.push(value);
          }
        } else if (key === "cost") {
          // Преобразуем cost в число или null с явным типом
          if (value !== null && value !== undefined && value !== "") {
            const numValue = parseFloat(value.toString());
            value = isNaN(numValue) ? null : numValue;
          } else {
            value = null;
          }
          paramCount++;
          fields.push(`${key} = $${paramCount}::numeric`);
          values.push(value);
        } else if (key === "purchase_date" || key === "warranty_until") {
          // Обрабатываем даты: пустые строки в null с явным типом
          value = cleanValue(value);
          paramCount++;
          fields.push(`${key} = $${paramCount}::date`);
          values.push(value);
        } else if (key === "current_owner_id") {
          // Пустые строки для owner_id в null с явным типом
          value = value && value !== "" ? value : null;
          paramCount++;
          fields.push(`${key} = $${paramCount}::uuid`);
          values.push(value);
        } else if (key === "attachments") {
          // Проверяем, что attachments - массив с явным типом
          value = value && Array.isArray(value) ? value : null;
          paramCount++;
          fields.push(`${key} = $${paramCount}::text[]`);
          values.push(value);
        } else {
          // Для остальных полей: пустые строки в null
          value = cleanValue(value);
          paramCount++;
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
        }
      });

      if (fields.length === 0) {
        return res.status(400).json({ error: "Нет полей для обновления" });
      }

      // Добавляем updated_at без параметра (используем NOW())
      fields.push(`updated_at = NOW()`);

      // Добавляем id в конец для WHERE условия
      paramCount++;
      values.push(id);

      const query = `UPDATE equipment SET ${fields.join(", ")} WHERE id = $${paramCount}::uuid RETURNING *`;

      console.log("SQL запрос:", query);
      console.log("Значения:", values);

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Оборудование не найдено" });
      }

      const equipment = result.rows[0];

      // Загружаем владельца
      let current_owner = null;
      if (equipment.current_owner_id) {
        const ownerResult = await pool.query(
          "SELECT id, email, full_name, department FROM users WHERE id = $1",
          [equipment.current_owner_id],
        );
        if (ownerResult.rows.length > 0) {
          current_owner = ownerResult.rows[0];
        }
      }

      res.json({
        data: {
          ...equipment,
          current_owner,
        },
      });
    } catch (error: any) {
      console.error("Ошибка обновления оборудования:", error);
      console.error("Детали ошибки:", {
        message: error.message,
        code: error.code,
        detail: error.detail,
        constraint: error.constraint,
        stack: error.stack,
      });

      if (error.code === "23505") {
        return res.status(400).json({
          error: "Оборудование с таким инвентарным номером уже существует",
        });
      }

      if (error.code === "23503") {
        return res
          .status(400)
          .json({ error: "Некорректный владелец оборудования" });
      }

      if (error.code === "23514") {
        return res
          .status(400)
          .json({ error: "Некорректное значение для категории или статуса" });
      }

      res.status(500).json({
        error: "Ошибка при обновлении оборудования",
        message:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

// Удалить оборудование
router.delete(
  "/:id",
  authenticate,
  requireRole("admin", "it_specialist"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        "DELETE FROM equipment WHERE id = $1 RETURNING id",
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Оборудование не найдено" });
      }

      res.json({ message: "Оборудование удалено" });
    } catch (error) {
      console.error("Ошибка удаления оборудования:", error);
      res.status(500).json({ error: "Ошибка при удалении оборудования" });
    }
  },
);

// Изменить владельца оборудования
router.post(
  "/:id/change-owner",
  authenticate,
  requireRole("admin", "it_specialist"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { newOwnerId, newLocation, reason } = req.body;

      // Получаем текущее оборудование
      const currentResult = await pool.query(
        "SELECT * FROM equipment WHERE id = $1",
        [id],
      );
      if (currentResult.rows.length === 0) {
        return res.status(404).json({ error: "Оборудование не найдено" });
      }

      const currentEquipment = currentResult.rows[0];

      // Обновляем оборудование
      const updateData: any = {
        current_owner_id: newOwnerId,
        updated_at: new Date().toISOString(),
      };

      if (newLocation) {
        const [department, room] = newLocation.split(" - ");
        updateData.location_department = department;
        updateData.location_room = room || "";
      }

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramCount = 0;

      Object.keys(updateData).forEach((key) => {
        paramCount++;
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(updateData[key]);
      });

      paramCount++;
      updateValues.push(id);

      await pool.query(
        `UPDATE equipment SET ${updateFields.join(", ")} WHERE id = $${paramCount}`,
        updateValues,
      );

      // Создаем запись в истории
      await pool.query(
        `INSERT INTO equipment_history (
        equipment_id, from_user_id, to_user_id, from_location, to_location,
        reason, changed_by_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          id,
          currentEquipment.current_owner_id,
          newOwnerId,
          currentEquipment.location_department
            ? `${currentEquipment.location_department}${currentEquipment.location_room ? " - " + currentEquipment.location_room : ""}`
            : null,
          newLocation,
          reason,
          req.userId,
        ],
      );

      // Получаем обновленное оборудование
      const updatedResult = await pool.query(
        "SELECT * FROM equipment WHERE id = $1",
        [id],
      );
      const equipment = updatedResult.rows[0];

      // Загружаем нового владельца
      let current_owner = null;
      if (equipment.current_owner_id) {
        const ownerResult = await pool.query(
          "SELECT id, email, full_name, department FROM users WHERE id = $1",
          [equipment.current_owner_id],
        );
        if (ownerResult.rows.length > 0) {
          current_owner = ownerResult.rows[0];
        }
      }

      res.json({
        data: {
          ...equipment,
          current_owner,
        },
      });
    } catch (error) {
      console.error("Ошибка изменения владельца:", error);
      res.status(500).json({ error: "Ошибка при изменении владельца" });
    }
  },
);

// Получить историю перемещений
router.get(
  "/:id/history",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        `SELECT
        eh.*,
        from_user.id as from_user_id,
        from_user.full_name as from_user_name,
        from_user.email as from_user_email,
        to_user.id as to_user_id,
        to_user.full_name as to_user_name,
        to_user.email as to_user_email,
        changed_by.id as changed_by_id,
        changed_by.full_name as changed_by_name,
        changed_by.email as changed_by_email
      FROM equipment_history eh
      LEFT JOIN users from_user ON eh.from_user_id = from_user.id
      LEFT JOIN users to_user ON eh.to_user_id = to_user.id
      LEFT JOIN users changed_by ON eh.changed_by_id = changed_by.id
      WHERE eh.equipment_id = $1
      ORDER BY eh.created_at DESC`,
        [id],
      );

      res.json({ data: result.rows });
    } catch (error) {
      console.error("Ошибка получения истории:", error);
      res.status(500).json({ error: "Ошибка при получении истории" });
    }
  },
);

// Получить расходные материалы для оборудования
router.get(
  "/:id/consumables",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;

      console.log("Запрос расходников для оборудования:", id);

      const result = await pool.query(
        "SELECT * FROM get_consumables_for_equipment($1)",
        [id],
      );

      console.log("Найдено расходников:", result.rows.length);
      if (result.rows.length > 0) {
        console.log("Пример расходника:", result.rows[0]);
      }

      res.json({ data: result.rows });
    } catch (error: any) {
      console.error("Ошибка получения расходников для оборудования:", error);
      console.error("Детали ошибки:", {
        message: error.message,
        code: error.code,
        stack: error.stack,
      });
      res.status(500).json({
        error: "Ошибка при получении расходников",
        message:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

// Связать расходник с оборудованием
router.post(
  "/:id/consumables",
  authenticate,
  requireRole("admin", "it_specialist"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { consumable_id, quantity_per_unit = 1 } = req.body;

      if (!consumable_id) {
        return res.status(400).json({ error: "ID расходника обязателен" });
      }

      const result = await pool.query(
        `INSERT INTO equipment_consumables (equipment_id, consumable_id, quantity_per_unit)
       VALUES ($1, $2, $3)
       ON CONFLICT (equipment_id, consumable_id)
       DO UPDATE SET quantity_per_unit = $3
       RETURNING *`,
        [id, consumable_id, quantity_per_unit],
      );

      res.json({ data: result.rows[0] });
    } catch (error: any) {
      console.error("Ошибка связывания расходника с оборудованием:", error);
      res.status(500).json({
        error: "Ошибка при связывании расходника с оборудованием",
        message:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

// Генерация QR-кода для оборудования
router.get(
  "/:id/qr-code",
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { format = "png", size = "200" } = req.query;

      // Проверяем существование оборудования
      const result = await pool.query(
        "SELECT id, name, inventory_number FROM equipment WHERE id = $1",
        [id],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Оборудование не найдено" });
      }

      const equipment = result.rows[0];

      // Формируем данные для QR-кода
      const qrData = JSON.stringify({
        type: "equipment",
        id: equipment.id,
        v: 1, // версия формата
      });

      const qrSize = Math.min(
        Math.max(parseInt(size as string) || 200, 100),
        500,
      );

      if (format === "svg") {
        // Возвращаем SVG
        const svg = await QRCode.toString(qrData, {
          type: "svg",
          width: qrSize,
          margin: 2,
          errorCorrectionLevel: "M",
        });

        res.setHeader("Content-Type", "image/svg+xml");
        res.send(svg);
      } else if (format === "dataurl") {
        // Возвращаем Data URL (для отображения в img src)
        const dataUrl = await QRCode.toDataURL(qrData, {
          width: qrSize,
          margin: 2,
          errorCorrectionLevel: "M",
        });

        res.json({
          data: {
            dataUrl,
            equipment: {
              id: equipment.id,
              name: equipment.name,
              inventory_number: equipment.inventory_number,
            },
          },
        });
      } else {
        // Возвращаем PNG (по умолчанию)
        const buffer = await QRCode.toBuffer(qrData, {
          type: "png",
          width: qrSize,
          margin: 2,
          errorCorrectionLevel: "M",
        });

        res.setHeader("Content-Type", "image/png");
        res.setHeader(
          "Content-Disposition",
          `inline; filename="qr-${equipment.inventory_number}.png"`,
        );
        res.send(buffer);
      }
    } catch (error: any) {
      console.error("Ошибка генерации QR-кода:", error);
      res.status(500).json({
        error: "Ошибка при генерации QR-кода",
        message:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

// Массовая генерация QR-кодов для печати
router.post(
  "/qr-codes/batch",
  authenticate,
  requireRole("admin", "it_specialist"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { equipment_ids } = req.body;

      if (
        !equipment_ids ||
        !Array.isArray(equipment_ids) ||
        equipment_ids.length === 0
      ) {
        return res
          .status(400)
          .json({ error: "Необходимо указать массив ID оборудования" });
      }

      if (equipment_ids.length > 50) {
        return res.status(400).json({ error: "Максимум 50 QR-кодов за раз" });
      }

      // Получаем оборудование
      const result = await pool.query(
        "SELECT id, name, inventory_number FROM equipment WHERE id = ANY($1)",
        [equipment_ids],
      );

      const qrCodes = await Promise.all(
        result.rows.map(async (equipment) => {
          const qrData = JSON.stringify({
            type: "equipment",
            id: equipment.id,
            v: 1,
          });

          const dataUrl = await QRCode.toDataURL(qrData, {
            width: 200,
            margin: 2,
            errorCorrectionLevel: "M",
          });

          return {
            id: equipment.id,
            name: equipment.name,
            inventory_number: equipment.inventory_number,
            qr_data_url: dataUrl,
          };
        }),
      );

      res.json({ data: qrCodes });
    } catch (error: any) {
      console.error("Ошибка массовой генерации QR-кодов:", error);
      res.status(500).json({
        error: "Ошибка при генерации QR-кодов",
        message:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  },
);

export default router;
