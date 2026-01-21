import { useState, useEffect, useRef } from "react";
import {
  Save,
  Mail,
  AlertCircle,
  CheckCircle,
  Upload,
  Trash2,
  Image,
} from "lucide-react";
import { settingsService } from "../../services/settings.service";
import type { SystemSetting, SettingType } from "../../types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

// Метаданные для типов настроек
const settingTypeMetadata: Record<
  SettingType | "branding",
  { title: string; description: string }
> = {
  branding: {
    title: "Брендинг",
    description: "Заголовок сайта и favicon",
  },
  smtp: {
    title: "Настройки SMTP",
    description: "Параметры почтового сервера для отправки уведомлений",
  },
  email: {
    title: "Настройки Email",
    description: "Параметры отправителя для email-уведомлений",
  },
  system: {
    title: "Системные настройки",
    description: "Общие параметры системы",
  },
  other: {
    title: "Прочие настройки",
    description: "Дополнительные параметры",
  },
};

// Удобочитаемые названия для настроек
const settingLabels: Record<string, string> = {
  smtp_host: "SMTP хост",
  smtp_port: "SMTP порт",
  smtp_user: "SMTP пользователь",
  smtp_password: "SMTP пароль",
  smtp_secure: "Использовать SSL/TLS",
  from_email: "Email отправителя",
  from_name: "Имя отправителя",
  site_title: "Заголовок сайта",
  site_favicon: "Favicon",
};

export const SystemSettings = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [isTestEmailModalOpen, setIsTestEmailModalOpen] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [deletingFavicon, setDeletingFavicon] = useState(false);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await settingsService.getSettings();
      if (result.error) {
        setError(result.error.message || "Ошибка при загрузке настроек");
      } else {
        setSettings(result.data);
      }
    } catch (err) {
      setError("Произошла ошибка при загрузке настроек");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Группировка настроек по типам
  const groupedSettings = settings.reduce(
    (acc, setting) => {
      const type = setting.setting_type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(setting);
      return acc;
    },
    {} as Record<SettingType, SystemSetting[]>,
  );

  const handleInputChange = (key: string, value: string) => {
    setEditedValues((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async (setting: SystemSetting) => {
    const newValue = editedValues[setting.setting_key];

    // Если значение не изменилось, не отправляем запрос
    if (newValue === undefined || newValue === setting.setting_value) {
      return;
    }

    // Если значение *** (замаскированное), не отправляем запрос
    if (newValue === "***") {
      return;
    }

    setSaving(setting.setting_key);
    setError(null);
    setSuccess(null);

    try {
      const result = await settingsService.updateSetting(
        setting.setting_key,
        newValue,
      );
      if (result.error) {
        setError(
          `Ошибка при сохранении ${setting.setting_key}: ${result.error.message}`,
        );
      } else {
        setSuccess(`Настройка ${setting.setting_key} успешно сохранена`);
        // Обновляем локальное состояние
        setSettings((prev) =>
          prev.map((s) =>
            s.setting_key === setting.setting_key
              ? { ...s, setting_value: result.data?.setting_value || newValue }
              : s,
          ),
        );
        // Очищаем отредактированное значение
        setEditedValues((prev) => {
          const newValues = { ...prev };
          delete newValues[setting.setting_key];
          return newValues;
        });

        // Скрываем сообщение об успехе через 3 секунды
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      }
    } catch (err) {
      setError("Произошла ошибка при сохранении настройки");
    } finally {
      setSaving(null);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress) {
      setError("Введите email адрес");
      return;
    }

    setSendingTestEmail(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await settingsService.sendTestEmail(testEmailAddress);
      if (result.error) {
        setError(
          `Ошибка при отправке тестового письма: ${result.error.message}`,
        );
      } else {
        setSuccess(`Тестовое письмо отправлено на ${testEmailAddress}`);
        setIsTestEmailModalOpen(false);
        setTestEmailAddress("");

        // Скрываем сообщение об успехе через 5 секунд
        setTimeout(() => {
          setSuccess(null);
        }, 5000);
      }
    } catch (err) {
      setError("Произошла ошибка при отправке тестового письма");
    } finally {
      setSendingTestEmail(false);
    }
  };

  const getCurrentValue = (setting: SystemSetting): string => {
    // Если есть отредактированное значение, возвращаем его
    if (editedValues[setting.setting_key] !== undefined) {
      return editedValues[setting.setting_key];
    }
    // Иначе возвращаем текущее значение из настройки
    return setting.setting_value || "";
  };

  const hasChanges = (setting: SystemSetting): boolean => {
    const editedValue = editedValues[setting.setting_key];
    return (
      editedValue !== undefined &&
      editedValue !== setting.setting_value &&
      editedValue !== "***"
    );
  };

  // Обработка загрузки favicon
  const handleFaviconUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверка размера файла (1MB)
    if (file.size > 1024 * 1024) {
      setError("Размер файла не должен превышать 1MB");
      return;
    }

    setUploadingFavicon(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await settingsService.uploadFavicon(file);
      if (result.error) {
        setError(`Ошибка загрузки favicon: ${result.error.message}`);
      } else {
        setSuccess("Favicon успешно загружен");
        // Обновляем локальное состояние
        setSettings((prev) =>
          prev.map((s) =>
            s.setting_key === "site_favicon"
              ? { ...s, setting_value: result.data?.url || "" }
              : s,
          ),
        );
        // Обновляем favicon на странице
        updatePageFavicon(result.data?.url || "");

        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError("Произошла ошибка при загрузке favicon");
    } finally {
      setUploadingFavicon(false);
      // Очищаем input
      if (faviconInputRef.current) {
        faviconInputRef.current.value = "";
      }
    }
  };

  // Удаление favicon
  const handleDeleteFavicon = async () => {
    setDeletingFavicon(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await settingsService.deleteFavicon();
      if (result.error) {
        setError(`Ошибка удаления favicon: ${result.error.message}`);
      } else {
        setSuccess("Favicon удален");
        // Обновляем локальное состояние
        setSettings((prev) =>
          prev.map((s) =>
            s.setting_key === "site_favicon" ? { ...s, setting_value: "" } : s,
          ),
        );
        // Возвращаем дефолтный favicon
        updatePageFavicon("");

        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError("Произошла ошибка при удалении favicon");
    } finally {
      setDeletingFavicon(false);
    }
  };

  // Обновление favicon на странице
  const updatePageFavicon = (url: string) => {
    const link: HTMLLinkElement =
      document.querySelector("link[rel*='icon']") ||
      document.createElement("link");
    link.type = "image/x-icon";
    link.rel = "icon";
    if (url) {
      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:3001/api";
      const baseUrl = apiUrl.replace("/api", "");
      link.href = `${baseUrl}${url}`;
    } else {
      link.href = "/vite.svg";
    }
    document.getElementsByTagName("head")[0].appendChild(link);
  };

  // Обновление title страницы при сохранении
  const handleSaveBranding = async (setting: SystemSetting) => {
    if (setting.setting_key === "site_title") {
      const newTitle = editedValues[setting.setting_key];
      await handleSave(setting);
      if (newTitle) {
        document.title = newTitle;
      }
    } else {
      await handleSave(setting);
    }
  };

  // Получаем текущий favicon URL
  const currentFaviconUrl = settings.find(
    (s) => s.setting_key === "site_favicon",
  )?.setting_value;

  return (
    <div>
      <div className="flex items-center justify-end mb-6">
        <Button
          onClick={() => setIsTestEmailModalOpen(true)}
          variant="secondary"
        >
          <Mail className="h-5 w-5 mr-2" />
          Тестовое письмо
        </Button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Секция брендинга - выводим первой */}
          {groupedSettings["branding" as SettingType] && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {settingTypeMetadata.branding.title}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {settingTypeMetadata.branding.description}
                </p>
              </div>

              <div className="p-6 space-y-6">
                {/* Заголовок сайта */}
                {groupedSettings["branding" as SettingType]
                  .filter((s) => s.setting_key === "site_title")
                  .map((setting) => (
                    <div
                      key={setting.id}
                      className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start"
                    >
                      <div>
                        <label
                          htmlFor={setting.setting_key}
                          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          {settingLabels[setting.setting_key] ||
                            setting.setting_key}
                        </label>
                        {setting.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {setting.description}
                          </p>
                        )}
                      </div>

                      <div className="md:col-span-2 flex items-center gap-2">
                        <input
                          id={setting.setting_key}
                          type="text"
                          value={getCurrentValue(setting)}
                          onChange={(e) =>
                            handleInputChange(
                              setting.setting_key,
                              e.target.value,
                            )
                          }
                          placeholder="Введите заголовок сайта"
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                        <Button
                          onClick={() => handleSaveBranding(setting)}
                          disabled={
                            !hasChanges(setting) ||
                            saving === setting.setting_key
                          }
                          variant={
                            hasChanges(setting) ? "primary" : "secondary"
                          }
                          size="sm"
                        >
                          {saving === setting.setting_key ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-1" />
                              Сохранить
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}

                {/* Favicon */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Favicon
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Иконка сайта (PNG, JPG, SVG, ICO, до 1MB)
                    </p>
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center gap-4">
                      {/* Превью текущего favicon */}
                      <div className="flex-shrink-0 w-12 h-12 border border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-700 overflow-hidden">
                        {currentFaviconUrl ? (
                          <img
                            src={`${(import.meta.env.VITE_API_URL || "http://localhost:3001/api").replace("/api", "")}${currentFaviconUrl}`}
                            alt="Favicon"
                            className="w-8 h-8 object-contain"
                          />
                        ) : (
                          <Image className="w-6 h-6 text-gray-400" />
                        )}
                      </div>

                      {/* Кнопки */}
                      <div className="flex items-center gap-2">
                        <input
                          ref={faviconInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon"
                          onChange={handleFaviconUpload}
                          className="hidden"
                          id="favicon-upload"
                        />
                        <Button
                          onClick={() => faviconInputRef.current?.click()}
                          disabled={uploadingFavicon}
                          variant="secondary"
                          size="sm"
                        >
                          {uploadingFavicon ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-1" />
                              Загрузить
                            </>
                          )}
                        </Button>

                        {currentFaviconUrl && (
                          <Button
                            onClick={handleDeleteFavicon}
                            disabled={deletingFavicon}
                            variant="danger"
                            size="sm"
                          >
                            {deletingFavicon ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Удалить
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Остальные настройки */}
          {(Object.keys(groupedSettings) as SettingType[])
            .filter((type) => type !== ("branding" as SettingType))
            .map((type) => {
              const metadata = settingTypeMetadata[type] || {
                title: type.toUpperCase(),
                description: `Настройки типа ${type}`,
              };

              return (
                <div
                  key={type}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden"
                >
                  <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {metadata.title}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {metadata.description}
                    </p>
                  </div>

                  <div className="p-6 space-y-4">
                    {groupedSettings[type].map((setting) => (
                      <div
                        key={setting.id}
                        className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start"
                      >
                        <div>
                          <label
                            htmlFor={setting.setting_key}
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                          >
                            {settingLabels[setting.setting_key] ||
                              setting.setting_key}
                          </label>
                          {setting.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {setting.description}
                            </p>
                          )}
                        </div>

                        <div className="md:col-span-2 flex items-center gap-2">
                          <input
                            id={setting.setting_key}
                            type={
                              setting.is_encrypted &&
                              setting.setting_value === "***"
                                ? "password"
                                : "text"
                            }
                            value={getCurrentValue(setting)}
                            onChange={(e) =>
                              handleInputChange(
                                setting.setting_key,
                                e.target.value,
                              )
                            }
                            placeholder={
                              setting.is_encrypted &&
                              setting.setting_value === "***"
                                ? "Введите новое значение для изменения"
                                : "Введите значение"
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          />
                          <Button
                            onClick={() => handleSave(setting)}
                            disabled={
                              !hasChanges(setting) ||
                              saving === setting.setting_key
                            }
                            variant={
                              hasChanges(setting) ? "primary" : "secondary"
                            }
                            size="sm"
                          >
                            {saving === setting.setting_key ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <>
                                <Save className="h-4 w-4 mr-1" />
                                Сохранить
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* Модальное окно для тестовой отправки email */}
      <Modal
        isOpen={isTestEmailModalOpen}
        onClose={() => {
          setIsTestEmailModalOpen(false);
          setTestEmailAddress("");
        }}
        title="Отправить тестовое письмо"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Введите email адрес для отправки тестового письма. Это поможет
            проверить корректность SMTP настроек.
          </p>
          <div>
            <label
              htmlFor="test-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Email адрес
            </label>
            <input
              id="test-email"
              type="email"
              value={testEmailAddress}
              onChange={(e) => setTestEmailAddress(e.target.value)}
              placeholder="example@example.com"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              onClick={() => {
                setIsTestEmailModalOpen(false);
                setTestEmailAddress("");
              }}
              variant="secondary"
            >
              Отмена
            </Button>
            <Button
              onClick={handleSendTestEmail}
              disabled={sendingTestEmail || !testEmailAddress}
            >
              {sendingTestEmail ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Отправка...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Отправить
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
