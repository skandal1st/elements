import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth.js';
import { zabbixService } from '../services/zabbix.service.js';
import { pool } from '../config/database.js';

const router = Router();

/**
 * GET /api/zabbix/status
 * Проверить статус подключения к Zabbix
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const connected = await zabbixService.checkConnection();
    if (connected) {
      const version = await zabbixService.getApiVersion();
      res.json({ connected: true, version });
    } else {
      res.json({ connected: false, version: null });
    }
  } catch (error) {
    console.error('Ошибка проверки Zabbix:', error);
    res.json({ connected: false, error: (error as Error).message });
  }
});

/**
 * GET /api/zabbix/hosts
 * Получить список хостов из Zabbix
 */
router.get('/hosts', authenticate, async (req, res) => {
  try {
    const { groupId } = req.query;
    const groupIds = groupId ? [groupId as string] : undefined;
    const hosts = await zabbixService.getHosts(groupIds);
    res.json(hosts);
  } catch (error) {
    console.error('Ошибка получения хостов Zabbix:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zabbix/host/:ip
 * Найти хост по IP адресу
 */
router.get('/host/:ip', authenticate, async (req, res) => {
  try {
    const { ip } = req.params;
    const host = await zabbixService.getHostByIP(ip);

    if (!host) {
      return res.json({ found: false, host: null });
    }

    // Получаем статус доступности
    const availability = await zabbixService.getHostAvailability(host.hostid);

    res.json({
      found: true,
      host: {
        ...host,
        ...availability,
      },
    });
  } catch (error) {
    console.error('Ошибка поиска хоста Zabbix:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zabbix/equipment/:id/status
 * Получить статус оборудования в Zabbix по ID оборудования
 */
router.get('/equipment/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Получаем IP оборудования из БД
    const equipmentResult = await pool.query(
      'SELECT ip_address, name, category FROM equipment WHERE id = $1',
      [id]
    );

    if (equipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Оборудование не найдено' });
    }

    const equipment = equipmentResult.rows[0];

    if (!equipment.ip_address) {
      return res.json({
        found: false,
        reason: 'no_ip',
        message: 'У оборудования не указан IP-адрес',
      });
    }

    // Ищем хост в Zabbix по IP
    const host = await zabbixService.getHostByIP(equipment.ip_address);

    if (!host) {
      return res.json({
        found: false,
        reason: 'not_in_zabbix',
        message: 'Устройство не найдено в Zabbix',
        ip: equipment.ip_address,
      });
    }

    // Получаем статус доступности
    const availability = await zabbixService.getHostAvailability(host.hostid);

    res.json({
      found: true,
      hostid: host.hostid,
      hostname: host.name,
      available: availability.available,
      lastCheck: availability.lastCheck,
      ip: equipment.ip_address,
    });
  } catch (error) {
    console.error('Ошибка получения статуса оборудования в Zabbix:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zabbix/equipment/:id/counters
 * Получить счётчики страниц принтера
 */
router.get('/equipment/:id/counters', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    // Получаем IP оборудования из БД
    const equipmentResult = await pool.query(
      'SELECT ip_address, name, category FROM equipment WHERE id = $1',
      [id]
    );

    if (equipmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Оборудование не найдено' });
    }

    const equipment = equipmentResult.rows[0];

    if (equipment.category !== 'printer') {
      return res.json({
        supported: false,
        message: 'Счётчики страниц доступны только для принтеров',
      });
    }

    if (!equipment.ip_address) {
      return res.json({
        supported: true,
        found: false,
        reason: 'no_ip',
        message: 'У принтера не указан IP-адрес',
      });
    }

    // Ищем хост в Zabbix
    const host = await zabbixService.getHostByIP(equipment.ip_address);

    if (!host) {
      return res.json({
        supported: true,
        found: false,
        reason: 'not_in_zabbix',
        message: 'Принтер не найден в Zabbix',
      });
    }

    // Получаем счётчики страниц и уровень расходников
    const [counters, suppliesData] = await Promise.all([
      zabbixService.getPageCounters(host.hostid),
      zabbixService.getSuppliesLevels(host.hostid),
    ]);

    res.json({
      supported: true,
      found: true,
      hostid: host.hostid,
      hostname: host.name,
      counters: {
        total: counters.total,
        black: counters.black,
        color: counters.color,
      },
      supplies: suppliesData.supplies,
      rawItems: [...counters.items, ...suppliesData.items],
    });
  } catch (error) {
    console.error('Ошибка получения счётчиков страниц:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zabbix/groups
 * Получить группы хостов Zabbix
 */
router.get('/groups', authenticate, async (req, res) => {
  try {
    const groups = await zabbixService.getHostGroups();
    res.json(groups);
  } catch (error) {
    console.error('Ошибка получения групп Zabbix:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * GET /api/zabbix/templates
 * Получить шаблоны Zabbix
 */
router.get('/templates', authenticate, async (req, res) => {
  try {
    const { search } = req.query;
    const templates = await zabbixService.getTemplates(search as string);
    res.json(templates);
  } catch (error) {
    console.error('Ошибка получения шаблонов Zabbix:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

/**
 * POST /api/zabbix/equipment/:id/add
 * Добавить оборудование в Zabbix
 */
router.post(
  '/equipment/:id/add',
  authenticate,
  requireRole('admin', 'it_specialist'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { groupId, templateId, snmpCommunity } = req.body;

      if (!groupId) {
        return res.status(400).json({ error: 'Не указана группа хостов (groupId)' });
      }

      // Получаем оборудование из БД
      const equipmentResult = await pool.query(
        'SELECT ip_address, name, model, inventory_number, category FROM equipment WHERE id = $1',
        [id]
      );

      if (equipmentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Оборудование не найдено' });
      }

      const equipment = equipmentResult.rows[0];

      if (!equipment.ip_address) {
        return res.status(400).json({ error: 'У оборудования не указан IP-адрес' });
      }

      // Проверяем, нет ли уже такого хоста в Zabbix
      const existingHost = await zabbixService.getHostByIP(equipment.ip_address);
      if (existingHost) {
        return res.status(409).json({
          error: 'Устройство с таким IP уже существует в Zabbix',
          hostid: existingHost.hostid,
          hostname: existingHost.name,
        });
      }

      // Формируем имя хоста
      const hostName = equipment.model
        ? `${equipment.name} ${equipment.model} (${equipment.inventory_number})`
        : `${equipment.name} (${equipment.inventory_number})`;

      // Формируем описание
      const description = `Добавлено из SupportIT\nИнвентарный номер: ${equipment.inventory_number}\nКатегория: ${equipment.category}`;

      // Создаём хост в Zabbix
      const result = await zabbixService.createHost({
        name: hostName,
        ip: equipment.ip_address,
        groupIds: [groupId],
        templateIds: templateId ? [templateId] : [],
        snmpCommunity: snmpCommunity || 'public',
        description,
      });

      res.json({
        success: true,
        hostid: result.hostids[0],
        message: 'Устройство успешно добавлено в Zabbix',
      });
    } catch (error) {
      console.error('Ошибка добавления оборудования в Zabbix:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

export default router;
