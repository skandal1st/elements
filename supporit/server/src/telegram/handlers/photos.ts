import jsQR from "jsqr";
import sharp from "sharp";
import { pool } from "../../config/database.js";
import type { BotContext, EquipmentData } from "../types.js";
import { formatEquipmentCard } from "../utils/formatters.js";
import { equipmentActionsKeyboard } from "../keyboards/inline.js";

interface QRData {
  type: string;
  id: string;
  v?: number;
}

export async function handlePhoto(ctx: BotContext): Promise<void> {
  const message = ctx.message;

  if (!message || !("photo" in message) || !message.photo) {
    return;
  }

  // Берём фото с наилучшим качеством (последнее в массиве)
  const photo = message.photo[message.photo.length - 1];

  try {
    await ctx.reply("🔍 Распознаю QR-код...");

    // Получаем ссылку на файл
    const file = await ctx.telegram.getFile(photo.file_id);

    if (!file.file_path) {
      await ctx.reply("❌ Не удалось загрузить изображение.");
      return;
    }

    // Скачиваем файл
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const response = await fetch(fileUrl);

    if (!response.ok) {
      await ctx.reply("❌ Не удалось загрузить изображение.");
      return;
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer());

    // Конвертируем изображение в raw RGBA для jsQR
    console.log(
      "[Telegram Photos] Обработка изображения размером:",
      imageBuffer.length,
      "байт",
    );

    // Пробуем несколько вариантов обработки для лучшего распознавания
    let qrCode = null;

    // Вариант 1: оригинальное изображение
    const { data: origData, info: origInfo } = await sharp(imageBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    console.log(
      "[Telegram Photos] Изображение:",
      origInfo.width,
      "x",
      origInfo.height,
    );

    qrCode = jsQR(
      new Uint8ClampedArray(origData.buffer),
      origInfo.width,
      origInfo.height,
    );

    // Вариант 2: с предобработкой (контраст и резкость, без greyscale)
    if (!qrCode) {
      console.log("[Telegram Photos] Пробуем с предобработкой...");
      try {
        const { data: procData, info: procInfo } = await sharp(imageBuffer)
          .normalise()
          .sharpen()
          .toColourspace("srgb")
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        qrCode = jsQR(
          new Uint8ClampedArray(procData.buffer),
          procInfo.width,
          procInfo.height,
        );
      } catch (procError) {
        console.log("[Telegram Photos] Ошибка при предобработке:", procError);
      }
    }

    // Вариант 3: увеличенное изображение
    if (!qrCode) {
      console.log("[Telegram Photos] Пробуем с увеличением...");
      try {
        const newWidth = Math.round(origInfo.width * 2);
        const newHeight = Math.round(origInfo.height * 2);
        const { data: resizedData, info: resizedInfo } = await sharp(
          imageBuffer,
        )
          .resize(newWidth, newHeight, { fit: "fill" })
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });

        qrCode = jsQR(
          new Uint8ClampedArray(resizedData.buffer),
          resizedInfo.width,
          resizedInfo.height,
        );
      } catch (resizeError) {
        console.log("[Telegram Photos] Ошибка при увеличении:", resizeError);
      }
    }

    console.log(
      "[Telegram Photos] Результат jsQR:",
      qrCode ? "найден" : "не найден",
    );

    if (!qrCode) {
      await ctx.reply(
        "❌ QR-код не найден на изображении.\n\n" +
          "💡 Попробуйте:\n" +
          "• Сделать фото ближе к QR-коду\n" +
          "• Улучшить освещение\n" +
          "• Убедиться, что QR-код не повреждён",
      );
      return;
    }

    // Парсим данные QR-кода
    let qrData: QRData;
    try {
      qrData = JSON.parse(qrCode.data);
    } catch {
      await ctx.reply(
        "❌ QR-код не является кодом оборудования SupporIT.\n\n" +
          `Содержимое: \`${qrCode.data.slice(0, 100)}\``,
        { parse_mode: "Markdown" },
      );
      return;
    }

    // Проверяем формат данных
    if (qrData.type !== "equipment" || !qrData.id) {
      await ctx.reply(
        "❌ QR-код не является кодом оборудования SupporIT.\n\n" +
          "Ожидается QR-код, сгенерированный в системе.",
      );
      return;
    }

    // Ищем оборудование в базе данных
    const equipment = await getEquipmentById(qrData.id);

    if (!equipment) {
      await ctx.reply(
        "❌ Оборудование не найдено в базе данных.\n\n" +
          `ID: \`${qrData.id}\``,
        { parse_mode: "Markdown" },
      );
      return;
    }

    // Отправляем карточку оборудования
    const message = formatEquipmentCard(equipment);
    await ctx.reply(message, {
      parse_mode: "Markdown",
      ...equipmentActionsKeyboard(equipment.id),
    });
  } catch (error) {
    console.error("[Telegram Photos] Ошибка обработки фото:", error);
    await ctx.reply("❌ Произошла ошибка при обработке изображения.");
  }
}

async function getEquipmentById(id: string): Promise<EquipmentData | null> {
  try {
    const result = await pool.query(
      `SELECT
         e.id, e.name, e.model, e.inventory_number, e.serial_number,
         e.category, e.status, e.manufacturer,
         e.location_department, e.location_room,
         e.purchase_date, e.warranty_until,
         u.full_name as owner_name
       FROM equipment e
       LEFT JOIN users u ON e.current_owner_id = u.id
       WHERE e.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as EquipmentData;
  } catch (error) {
    console.error("[Telegram Photos] Ошибка получения оборудования:", error);
    return null;
  }
}

export async function handleEquipmentCreateTicket(
  ctx: BotContext,
  equipmentId: string,
): Promise<void> {
  // Сохраняем ID оборудования для создания заявки
  ctx.state.pendingTicketEquipmentId = equipmentId;

  try {
    const result = await pool.query(
      `SELECT name, inventory_number, location_department, location_room
       FROM equipment WHERE id = $1`,
      [equipmentId],
    );

    if (result.rows.length === 0) {
      await ctx.answerCbQuery("Оборудование не найдено");
      return;
    }

    const equipment = result.rows[0];

    await ctx.editMessageText(
      "📝 *Создание заявки*\n\n" +
        `🖥 Оборудование: ${equipment.name}\n` +
        `🔢 Инв. номер: ${equipment.inventory_number}\n\n` +
        "Отправьте описание проблемы следующим сообщением.\n\n" +
        "_Для отмены нажмите кнопку ниже._",
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Отмена", callback_data: "cancel_action" }],
          ],
        },
      },
    );
  } catch (error) {
    console.error("[Telegram Photos] Ошибка создания заявки:", error);
    await ctx.answerCbQuery("Ошибка");
  }
}

export async function handleEquipmentHistory(
  ctx: BotContext,
  equipmentId: string,
): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT
         eh.created_at,
         eh.from_location,
         eh.to_location,
         eh.reason,
         from_user.full_name as from_user_name,
         to_user.full_name as to_user_name,
         changed_by.full_name as changed_by_name
       FROM equipment_history eh
       LEFT JOIN users from_user ON eh.from_user_id = from_user.id
       LEFT JOIN users to_user ON eh.to_user_id = to_user.id
       LEFT JOIN users changed_by ON eh.changed_by_id = changed_by.id
       WHERE eh.equipment_id = $1
       ORDER BY eh.created_at DESC
       LIMIT 10`,
      [equipmentId],
    );

    if (result.rows.length === 0) {
      await ctx.answerCbQuery("История перемещений пуста");
      return;
    }

    let message = "📜 *История перемещений*\n\n";

    for (const record of result.rows) {
      const date = new Date(record.created_at).toLocaleDateString("ru-RU");

      message += `📅 ${date}\n`;

      if (record.from_user_name || record.to_user_name) {
        if (record.from_user_name && record.to_user_name) {
          message += `👤 ${record.from_user_name} → ${record.to_user_name}\n`;
        } else if (record.to_user_name) {
          message += `👤 → ${record.to_user_name}\n`;
        } else if (record.from_user_name) {
          message += `👤 ${record.from_user_name} →\n`;
        }
      }

      if (record.from_location || record.to_location) {
        message += `🏢 ${record.from_location || "?"} → ${record.to_location || "?"}\n`;
      }

      if (record.reason) {
        message += `📝 ${record.reason}\n`;
      }

      message += "\n";
    }

    await ctx.editMessageText(message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "« Назад", callback_data: "main_menu" }]],
      },
    });
  } catch (error) {
    console.error("[Telegram Photos] Ошибка получения истории:", error);
    await ctx.answerCbQuery("Ошибка загрузки истории");
  }
}
