// Ленивая загрузка ldapts - модуль загружается только при использовании AD
let Client: any = null;

async function getLdapClient() {
  if (!Client) {
    const ldapts = await import("ldapts");
    Client = ldapts.Client;
  }
  return Client;
}

// Интерфейс пользователя AD
export interface ADUser {
  dn: string;
  sAMAccountName: string;
  userPrincipalName: string;
  mail: string | null;
  displayName: string;
  givenName: string | null;
  sn: string | null; // surname
  department: string | null;
  title: string | null;
  telephoneNumber: string | null;
  mobile: string | null;
  physicalDeliveryOfficeName: string | null;
  memberOf: string[];
  enabled: boolean;
  whenCreated: string | null;
  lastLogon: string | null;
}

// Интерфейс группы AD
export interface ADGroup {
  dn: string;
  cn: string;
  description: string | null;
  member: string[];
}

// Конфигурация AD
interface ADConfig {
  url: string;
  baseDN: string;
  bindDN: string;
  bindPassword: string;
  usersOU?: string;
  groupsOU?: string;
  tlsOptions?: {
    rejectUnauthorized: boolean;
  };
}

// Получение конфигурации из переменных окружения
function getConfig(): ADConfig {
  const url = process.env.AD_URL;
  const baseDN = process.env.AD_BASE_DN;
  const bindDN = process.env.AD_BIND_DN;
  const bindPassword = process.env.AD_BIND_PASSWORD;

  if (!url || !baseDN || !bindDN || !bindPassword) {
    throw new Error(
      "AD configuration incomplete. Required: AD_URL, AD_BASE_DN, AD_BIND_DN, AD_BIND_PASSWORD",
    );
  }

  return {
    url,
    baseDN,
    bindDN,
    bindPassword,
    usersOU: process.env.AD_USERS_OU,
    groupsOU: process.env.AD_GROUPS_OU,
    tlsOptions: {
      rejectUnauthorized: process.env.AD_TLS_REJECT_UNAUTHORIZED !== "false",
    },
  };
}

// Проверка включена ли интеграция с AD
export function isADEnabled(): boolean {
  return process.env.AD_ENABLED === "true";
}

// Создание LDAP клиента
async function createClient(): Promise<any> {
  const config = getConfig();
  const ClientClass = await getLdapClient();

  // tlsOptions только для ldaps://
  const clientOptions: {
    url: string;
    tlsOptions?: { rejectUnauthorized: boolean };
  } = {
    url: config.url,
  };

  if (config.url.startsWith("ldaps://")) {
    clientOptions.tlsOptions = config.tlsOptions;
  }

  const client = new ClientClass(clientOptions);

  await client.bind(config.bindDN, config.bindPassword);

  return client;
}

// Парсинг userAccountControl для определения статуса аккаунта
function isAccountEnabled(
  userAccountControl: number | string | undefined,
): boolean {
  if (!userAccountControl) return true;
  const uac =
    typeof userAccountControl === "string"
      ? parseInt(userAccountControl, 10)
      : userAccountControl;
  // Бит 2 (0x2) = ACCOUNTDISABLE
  return (uac & 2) === 0;
}

// Преобразование Windows FileTime в Date
function fileTimeToDate(fileTime: string | undefined): string | null {
  if (!fileTime || fileTime === "0") return null;
  const ft = BigInt(fileTime);
  // Windows FileTime: 100-nanosecond intervals since January 1, 1601
  const epochDiff = BigInt("116444736000000000");
  const unixTimestamp = Number((ft - epochDiff) / BigInt(10000));
  return new Date(unixTimestamp).toISOString();
}

// Преобразование записи LDAP в ADUser
function parseADUser(entry: any): ADUser {
  const getValue = (attr: string): string | null => {
    const value = entry[attr];
    if (Array.isArray(value)) return value[0] || null;
    return value || null;
  };

  const getArrayValue = (attr: string): string[] => {
    const value = entry[attr];
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return [value];
  };

  return {
    dn: entry.dn || "",
    sAMAccountName: getValue("sAMAccountName") || "",
    userPrincipalName: getValue("userPrincipalName") || "",
    mail: getValue("mail"),
    displayName: getValue("displayName") || getValue("cn") || "",
    givenName: getValue("givenName"),
    sn: getValue("sn"),
    department: getValue("department"),
    title: getValue("title"),
    telephoneNumber: getValue("telephoneNumber"),
    mobile: getValue("mobile"),
    physicalDeliveryOfficeName: getValue("physicalDeliveryOfficeName"),
    memberOf: getArrayValue("memberOf"),
    enabled: isAccountEnabled(entry.userAccountControl),
    whenCreated: getValue("whenCreated"),
    lastLogon: fileTimeToDate(getValue("lastLogon") || undefined),
  };
}

// Преобразование записи LDAP в ADGroup
function parseADGroup(entry: any): ADGroup {
  const getValue = (attr: string): string | null => {
    const value = entry[attr];
    if (Array.isArray(value)) return value[0] || null;
    return value || null;
  };

  const getArrayValue = (attr: string): string[] => {
    const value = entry[attr];
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return [value];
  };

  return {
    dn: entry.dn || "",
    cn: getValue("cn") || "",
    description: getValue("description"),
    member: getArrayValue("member"),
  };
}

// Получение списка пользователей из AD
export async function getADUsers(filter?: string): Promise<ADUser[]> {
  const config = getConfig();
  const client = await createClient();

  try {
    const searchBase = config.usersOU || config.baseDN;

    // Базовый фильтр для пользователей
    let ldapFilter = "(&(objectClass=user)(objectCategory=person)";

    // Добавляем поисковый фильтр если указан
    if (filter) {
      const escapedFilter = filter.replace(/[\\*()]/g, "\\$&");
      ldapFilter += `(|(sAMAccountName=*${escapedFilter}*)(displayName=*${escapedFilter}*)(mail=*${escapedFilter}*)(givenName=*${escapedFilter}*)(sn=*${escapedFilter}*))`;
    }

    ldapFilter += ")";

    const { searchEntries } = await client.search(searchBase, {
      scope: "sub",
      filter: ldapFilter,
      attributes: [
        "dn",
        "sAMAccountName",
        "userPrincipalName",
        "mail",
        "displayName",
        "cn",
        "givenName",
        "sn",
        "department",
        "title",
        "telephoneNumber",
        "mobile",
        "physicalDeliveryOfficeName",
        "memberOf",
        "userAccountControl",
        "whenCreated",
        "lastLogon",
      ],
      sizeLimit: 1000,
    });

    return searchEntries.map(parseADUser);
  } finally {
    await client.unbind();
  }
}

// Получение пользователя по sAMAccountName
export async function getADUserByUsername(
  username: string,
): Promise<ADUser | null> {
  const config = getConfig();
  const client = await createClient();

  try {
    const searchBase = config.usersOU || config.baseDN;
    const escapedUsername = username.replace(/[\\*()]/g, "\\$&");

    const { searchEntries } = await client.search(searchBase, {
      scope: "sub",
      filter: `(&(objectClass=user)(objectCategory=person)(sAMAccountName=${escapedUsername}))`,
      attributes: [
        "dn",
        "sAMAccountName",
        "userPrincipalName",
        "mail",
        "displayName",
        "cn",
        "givenName",
        "sn",
        "department",
        "title",
        "telephoneNumber",
        "mobile",
        "physicalDeliveryOfficeName",
        "memberOf",
        "userAccountControl",
        "whenCreated",
        "lastLogon",
      ],
    });

    if (searchEntries.length === 0) return null;
    return parseADUser(searchEntries[0]);
  } finally {
    await client.unbind();
  }
}

// Получение списка групп из AD
export async function getADGroups(filter?: string): Promise<ADGroup[]> {
  const config = getConfig();
  const client = await createClient();

  try {
    const searchBase = config.groupsOU || config.baseDN;

    let ldapFilter = "(objectClass=group)";

    if (filter) {
      const escapedFilter = filter.replace(/[\\*()]/g, "\\$&");
      ldapFilter = `(&(objectClass=group)(|(cn=*${escapedFilter}*)(description=*${escapedFilter}*)))`;
    }

    const { searchEntries } = await client.search(searchBase, {
      scope: "sub",
      filter: ldapFilter,
      attributes: ["dn", "cn", "description", "member"],
      sizeLimit: 500,
    });

    return searchEntries.map(parseADGroup);
  } finally {
    await client.unbind();
  }
}

// Проверка подключения к AD
export async function testADConnection(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const config = getConfig();
    const client = await createClient();

    // Пробуем выполнить простой поиск
    const { searchEntries } = await client.search(config.baseDN, {
      scope: "base",
      filter: "(objectClass=*)",
      attributes: ["distinguishedName"],
    });

    await client.unbind();

    return {
      success: true,
      message: `Подключение успешно. Base DN: ${searchEntries[0]?.dn || config.baseDN}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Ошибка подключения: ${error.message}`,
    };
  }
}

// Аутентификация пользователя через AD
export async function authenticateADUser(
  username: string,
  password: string,
): Promise<{ success: boolean; user?: ADUser; message?: string }> {
  try {
    const config = getConfig();

    // Сначала находим пользователя
    const user = await getADUserByUsername(username);
    if (!user) {
      return { success: false, message: "Пользователь не найден" };
    }

    if (!user.enabled) {
      return { success: false, message: "Учётная запись отключена" };
    }

    // Пробуем аутентифицироваться от имени пользователя
    const ClientClass = await getLdapClient();
    const clientOptions: {
      url: string;
      tlsOptions?: { rejectUnauthorized: boolean };
    } = {
      url: config.url,
    };
    if (config.url.startsWith("ldaps://")) {
      clientOptions.tlsOptions = config.tlsOptions;
    }
    const client = new ClientClass(clientOptions);

    try {
      await client.bind(user.dn, password);
      await client.unbind();
      return { success: true, user };
    } catch {
      return { success: false, message: "Неверный пароль" };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Ошибка аутентификации: ${error.message}`,
    };
  }
}
