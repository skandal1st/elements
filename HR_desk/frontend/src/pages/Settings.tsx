import { useEffect, useState, useRef } from "react";
import { Upload, Trash2, Save } from "lucide-react";

import { settingsService, SystemSetting } from "../api/settings";
import { applyBranding, updateFavicon } from "../hooks/useBranding";

function getBaseUrl(): string {
  return window.location.origin;
}

export function Settings() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = async () => {
    try {
      const data = await settingsService.getAllSettings();
      setSettings(data);
      const values: Record<string, string> = {};
      for (const setting of data) {
        values[setting.setting_key] = setting.setting_value || "";
      }
      setEditedValues(values);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (key: string) => {
    setError(null);
    setSuccess(null);
    try {
      await settingsService.updateSetting(key, editedValues[key]);
      setSuccess("Настройка сохранена");
      if (key === "site_title") {
        document.title = editedValues[key];
        applyBranding({
          site_title: editedValues[key],
          site_favicon: editedValues["site_favicon"] || "",
        });
      }
      await loadSettings();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleFaviconUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setError("Размер файла не должен превышать 1MB");
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      const result = await settingsService.uploadFavicon(file);
      setSuccess("Favicon успешно загружен");
      updateFavicon(result.url);
      await loadSettings();
    } catch (err) {
      setError((err as Error).message);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteFavicon = async () => {
    setError(null);
    setSuccess(null);
    try {
      await settingsService.deleteFavicon();
      setSuccess("Favicon удален");
      updateFavicon("");
      await loadSettings();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const siteTitleSetting = settings.find((s) => s.setting_key === "site_title");
  const faviconSetting = settings.find((s) => s.setting_key === "site_favicon");

  if (loading) {
    return (
      <section className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Настройки
          </h2>
        </div>
        <p className="text-sm text-gray-500">Загрузка...</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Настройки
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Управление брендингом и системными настройками
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-400">
            {success}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Брендинг
        </h3>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Название сайта
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Отображается в заголовке вкладки браузера
            </p>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
                value={editedValues["site_title"] || ""}
                onChange={(e) =>
                  setEditedValues((prev) => ({
                    ...prev,
                    site_title: e.target.value,
                  }))
                }
                placeholder="HR Desk"
              />
              <button
                onClick={() => handleSave("site_title")}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
              >
                <Save className="h-4 w-4" />
                Сохранить
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Favicon
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Иконка сайта. Поддерживаемые форматы: PNG, JPG, GIF, SVG, ICO.
              Максимум 1MB.
            </p>
            <div className="flex items-center gap-4">
              {faviconSetting?.setting_value && (
                <div className="flex items-center gap-2">
                  <img
                    src={`${getBaseUrl()}${faviconSetting.setting_value}`}
                    alt="Current favicon"
                    className="w-8 h-8 rounded border border-gray-200 dark:border-gray-700"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Текущий favicon
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/svg+xml,image/x-icon"
                  onChange={handleFaviconUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Upload className="h-4 w-4" />
                  Загрузить
                </button>
                {faviconSetting?.setting_value && (
                  <button
                    onClick={handleDeleteFavicon}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    Удалить
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
