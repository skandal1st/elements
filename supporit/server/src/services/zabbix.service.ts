/**
 * Zabbix API Service
 * Интеграция с Zabbix 7.x через JSON-RPC API
 */

const ZABBIX_URL = process.env.ZABBIX_URL || 'http://localhost/api_jsonrpc.php';
const ZABBIX_API_TOKEN = process.env.ZABBIX_API_TOKEN || '';

interface ZabbixResponse<T> {
  jsonrpc: string;
  result: T;
  error?: {
    code: number;
    message: string;
    data: string;
  };
  id: number;
}

interface ZabbixHost {
  hostid: string;
  host: string;
  name: string;
  status: string;
  interfaces?: Array<{
    interfaceid: string;
    ip: string;
    type: string;
    main: string;
    available: string;
  }>;
}

interface ZabbixItem {
  itemid: string;
  name: string;
  key_: string;
  lastvalue: string;
  lastclock: string;
  units: string;
}

interface ZabbixGroup {
  groupid: string;
  name: string;
}

interface ZabbixTemplate {
  templateid: string;
  name: string;
  host: string;
}

// Счётчик запросов для уникальных ID
let requestId = 1;

/**
 * Выполнить запрос к Zabbix API
 */
async function zabbixRequest<T>(method: string, params: Record<string, any> = {}): Promise<T> {
  if (!ZABBIX_URL || !ZABBIX_API_TOKEN) {
    throw new Error('Zabbix не настроен. Проверьте ZABBIX_URL и ZABBIX_API_TOKEN');
  }

  const body = {
    jsonrpc: '2.0',
    method,
    params,
    id: requestId++,
  };

  const response = await fetch(ZABBIX_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ZABBIX_API_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Zabbix API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as ZabbixResponse<T>;

  if (data.error) {
    throw new Error(`Zabbix API error: ${data.error.message} - ${data.error.data}`);
  }

  return data.result;
}

/**
 * Проверить подключение к Zabbix
 */
async function checkConnection(): Promise<boolean> {
  try {
    await zabbixRequest<string>('apiinfo.version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Получить версию Zabbix API
 */
async function getApiVersion(): Promise<string> {
  return zabbixRequest<string>('apiinfo.version');
}

/**
 * Получить список всех хостов
 */
async function getHosts(groupIds?: string[]): Promise<ZabbixHost[]> {
  const params: Record<string, any> = {
    output: ['hostid', 'host', 'name', 'status'],
    selectInterfaces: ['interfaceid', 'ip', 'type', 'main', 'available'],
  };

  if (groupIds && groupIds.length > 0) {
    params.groupids = groupIds;
  }

  return zabbixRequest<ZabbixHost[]>('host.get', params);
}

/**
 * Найти хост по IP адресу
 */
async function getHostByIP(ip: string): Promise<ZabbixHost | null> {
  const hosts = await zabbixRequest<ZabbixHost[]>('host.get', {
    output: ['hostid', 'host', 'name', 'status'],
    selectInterfaces: ['interfaceid', 'ip', 'type', 'main', 'available'],
    filter: {},
    searchByAny: true,
  });

  // Фильтруем по IP в интерфейсах
  const host = hosts.find(h =>
    h.interfaces?.some(iface => iface.ip === ip)
  );

  return host || null;
}

/**
 * Получить метрики (items) хоста
 */
async function getHostItems(hostId: string, search?: string): Promise<ZabbixItem[]> {
  const params: Record<string, any> = {
    hostids: hostId,
    output: ['itemid', 'name', 'key_', 'lastvalue', 'lastclock', 'units'],
  };

  if (search) {
    params.search = { key_: search };
    params.searchWildcardsEnabled = true;
  }

  return zabbixRequest<ZabbixItem[]>('item.get', params);
}

/**
 * Получить счётчики страниц принтера
 */
async function getPageCounters(hostId: string): Promise<{
  total: number | null;
  black: number | null;
  color: number | null;
  items: ZabbixItem[];
}> {
  // Ищем items связанные со счётчиками страниц
  // Стандартные SNMP OID ключи для принтеров
  const items = await getHostItems(hostId);

  // Фильтруем items по известным ключам счётчиков
  const pageCounterKeys = [
    'hrPrinterLifeCount',
    'prtMarkerLifeCount',
    'prtMIBLifeCount',
    'printer.pages',
    'pages.total',
    'pages.black',
    'pages.color',
  ];

  const counterItems = items.filter(item =>
    pageCounterKeys.some(key =>
      item.key_.toLowerCase().includes(key.toLowerCase()) ||
      item.name.toLowerCase().includes('page') ||
      item.name.toLowerCase().includes('count') ||
      item.name.toLowerCase().includes('страниц')
    )
  );

  // Пытаемся определить тип счётчика
  let total: number | null = null;
  let black: number | null = null;
  let color: number | null = null;

  for (const item of counterItems) {
    const value = parseInt(item.lastvalue, 10);
    if (isNaN(value)) continue;

    const keyLower = item.key_.toLowerCase();
    const nameLower = item.name.toLowerCase();

    if (keyLower.includes('black') || nameLower.includes('black') || nameLower.includes('чёрн')) {
      black = value;
    } else if (keyLower.includes('color') || nameLower.includes('color') || nameLower.includes('цвет')) {
      color = value;
    } else if (keyLower.includes('life') || keyLower.includes('total') || nameLower.includes('total') || nameLower.includes('всего')) {
      total = value;
    } else if (total === null) {
      // Если не определили тип, считаем что это общий счётчик
      total = value;
    }
  }

  return { total, black, color, items: counterItems };
}

/**
 * Получить уровень расходных материалов (чернила/тонер)
 */
async function getSuppliesLevels(hostId: string): Promise<{
  supplies: Array<{
    name: string;
    level: number | null;
    maxLevel: number | null;
    percent: number | null;
    color?: string;
  }>;
  items: ZabbixItem[];
}> {
  const items = await getHostItems(hostId);

  // Ключевые слова для поиска расходников
  const suppliesKeywords = [
    'marker', 'supply', 'supplies', 'toner', 'ink', 'drum',
    'cartridge', 'level', 'capacity', 'remaining',
    'чернил', 'тонер', 'картридж', 'уровень'
  ];

  // Фильтруем items по ключевым словам
  const suppliesItems = items.filter(item => {
    const keyLower = item.key_.toLowerCase();
    const nameLower = item.name.toLowerCase();
    return suppliesKeywords.some(kw =>
      keyLower.includes(kw) || nameLower.includes(kw)
    );
  });

  console.log('Found supplies items:', suppliesItems.map(i => ({ name: i.name, key: i.key_, value: i.lastvalue })));

  // Группируем по типу расходника
  const supplies: Array<{
    name: string;
    level: number | null;
    maxLevel: number | null;
    percent: number | null;
    color?: string;
  }> = [];

  // Определяем цвет по названию
  const getColor = (name: string): string | undefined => {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('black') || nameLower.includes('чёрн') || nameLower.includes('черн')) return 'black';
    if (nameLower.includes('cyan') || nameLower.includes('голуб')) return 'cyan';
    if (nameLower.includes('magenta') || nameLower.includes('пурпур')) return 'magenta';
    if (nameLower.includes('yellow') || nameLower.includes('жёлт') || nameLower.includes('желт')) return 'yellow';
    return undefined;
  };

  // Обрабатываем найденные items
  for (const item of suppliesItems) {
    const value = parseInt(item.lastvalue, 10);
    if (isNaN(value)) continue;

    const nameLower = item.name.toLowerCase();
    const keyLower = item.key_.toLowerCase();

    // Пропускаем max capacity items - они будут использоваться для расчёта процентов
    if (keyLower.includes('max') || nameLower.includes('max')) continue;

    // Определяем, это уровень в процентах или абсолютное значение
    const isPercent = item.units === '%' ||
                      keyLower.includes('percent') ||
                      nameLower.includes('percent') ||
                      (value >= 0 && value <= 100 && !keyLower.includes('count'));

    const color = getColor(item.name);

    // Ищем, нет ли уже такого расходника
    const existingIndex = supplies.findIndex(s =>
      s.color === color && color !== undefined
    );

    if (existingIndex >= 0) {
      // Обновляем существующий
      if (isPercent) {
        supplies[existingIndex].percent = value;
      } else {
        supplies[existingIndex].level = value;
      }
    } else {
      // Добавляем новый
      supplies.push({
        name: item.name,
        level: isPercent ? null : value,
        maxLevel: null,
        percent: isPercent ? value : null,
        color,
      });
    }
  }

  return { supplies, items: suppliesItems };
}

/**
 * Получить статус доступности хоста
 * В Zabbix 7.x проверяем доступность через интерфейсы и активные проблемы
 */
async function getHostAvailability(hostId: string): Promise<{
  available: boolean;
  lastCheck: string | null;
}> {
  try {
    // Получаем хост с интерфейсами
    const hosts = await zabbixRequest<any[]>('host.get', {
      hostids: hostId,
      output: ['hostid', 'host', 'name', 'status'],
      selectInterfaces: ['interfaceid', 'ip', 'type', 'main', 'available', 'error'],
    });

    if (hosts.length === 0) {
      return { available: false, lastCheck: null };
    }

    const host = hosts[0];

    // Логируем для отладки
    console.log('Host availability check:', {
      hostid: host.hostid,
      name: host.name,
      status: host.status,
      interfaces: host.interfaces,
    });

    // Проверяем статус хоста (status: 0 = enabled, 1 = disabled)
    if (host.status === '1') {
      return { available: false, lastCheck: new Date().toISOString() };
    }

    // Ищем главный интерфейс (любого типа)
    const mainInterface = host.interfaces?.find((i: any) => i.main === '1');

    if (mainInterface) {
      // available: 0 = unknown, 1 = available, 2 = unavailable
      // Для SNMP (type=2) в Zabbix 7.x available может быть числом или строкой
      const availableValue = parseInt(mainInterface.available, 10);
      const isAvailable = availableValue === 1;

      console.log('Interface availability:', {
        type: mainInterface.type,
        available: mainInterface.available,
        availableValue,
        isAvailable,
      });

      return {
        available: isAvailable,
        lastCheck: new Date().toISOString(),
      };
    }

    // Если нет главного интерфейса, проверяем все
    const anyAvailable = host.interfaces?.some((i: any) => {
      const av = parseInt(i.available, 10);
      return av === 1;
    });

    return {
      available: anyAvailable || false,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error checking host availability:', error);
    return { available: false, lastCheck: null };
  }
}

/**
 * Получить группы хостов
 */
async function getHostGroups(): Promise<ZabbixGroup[]> {
  return zabbixRequest<ZabbixGroup[]>('hostgroup.get', {
    output: ['groupid', 'name'],
    sortfield: 'name',
  });
}

/**
 * Получить шаблоны
 */
async function getTemplates(search?: string): Promise<ZabbixTemplate[]> {
  const params: Record<string, any> = {
    output: ['templateid', 'name', 'host'],
    sortfield: 'name',
  };

  if (search) {
    params.search = { name: search };
    params.searchWildcardsEnabled = true;
  }

  return zabbixRequest<ZabbixTemplate[]>('template.get', params);
}

/**
 * Создать хост в Zabbix
 */
async function createHost(options: {
  name: string;
  ip: string;
  groupIds: string[];
  templateIds?: string[];
  snmpCommunity?: string;
  description?: string;
}): Promise<{ hostids: string[] }> {
  const { name, ip, groupIds, templateIds = [], snmpCommunity = 'public', description } = options;

  // Создаём имя хоста (без пробелов и спецсимволов)
  const hostTechnicalName = name
    .replace(/[^a-zA-Z0-9\-_]/g, '_')
    .substring(0, 64);

  const params: Record<string, any> = {
    host: hostTechnicalName,
    name: name,
    groups: groupIds.map(id => ({ groupid: id })),
    interfaces: [
      {
        type: 2, // SNMP
        main: 1,
        useip: 1,
        ip: ip,
        dns: '',
        port: '161',
        details: {
          version: 2, // SNMP v2c
          community: snmpCommunity,
        },
      },
    ],
  };

  if (templateIds.length > 0) {
    params.templates = templateIds.map(id => ({ templateid: id }));
  }

  if (description) {
    params.description = description;
  }

  return zabbixRequest<{ hostids: string[] }>('host.create', params);
}

/**
 * Удалить хост из Zabbix
 */
async function deleteHost(hostId: string): Promise<{ hostids: string[] }> {
  return zabbixRequest<{ hostids: string[] }>('host.delete', [hostId]);
}

export const zabbixService = {
  checkConnection,
  getApiVersion,
  getHosts,
  getHostByIP,
  getHostItems,
  getPageCounters,
  getSuppliesLevels,
  getHostAvailability,
  getHostGroups,
  getTemplates,
  createHost,
  deleteHost,
};
