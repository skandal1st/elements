import { useState } from "react";
import {
  Settings as SettingsIcon,
  Server,
  Building2,
  Package,
  List,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { Tabs } from "../components/ui/Tabs";
import { SystemSettings } from "../components/settings/SystemSettings";
import { BuildingsSettings } from "../components/settings/BuildingsSettings";
import { DictionariesSettings } from "../components/settings/DictionariesSettings";
import { TelegramSettings } from "../components/settings/TelegramSettings";
import { SystemUpdateSettings } from "../components/settings/SystemUpdateSettings";
import { useAuthStore } from "../store/auth.store";

export const SettingsPage = () => {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  const [activeTab, setActiveTab] = useState(isAdmin ? "system" : "telegram");

  // Полный набор вкладок для админа
  const adminTabs = [
    {
      id: "system",
      label: "Системные настройки",
      icon: <Server className="h-4 w-4" />,
    },
    {
      id: "updates",
      label: "Обновления",
      icon: <RefreshCw className="h-4 w-4" />,
    },
    {
      id: "telegram",
      label: "Telegram",
      icon: <MessageCircle className="h-4 w-4" />,
    },
    {
      id: "buildings",
      label: "Здания",
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      id: "equipment_categories",
      label: "Категории оборудования",
      icon: <Package className="h-4 w-4" />,
    },
    {
      id: "equipment_statuses",
      label: "Статусы оборудования",
      icon: <List className="h-4 w-4" />,
    },
  ];

  // Только Telegram для IT-специалистов
  const itSpecialistTabs = [
    {
      id: "telegram",
      label: "Telegram",
      icon: <MessageCircle className="h-4 w-4" />,
    },
  ];

  const tabs = isAdmin ? adminTabs : itSpecialistTabs;

  const renderTabContent = () => {
    switch (activeTab) {
      case "system":
        return <SystemSettings />;
      case "updates":
        return <SystemUpdateSettings />;
      case "telegram":
        return <TelegramSettings />;
      case "buildings":
        return <BuildingsSettings />;
      case "equipment_categories":
        return <DictionariesSettings type="equipment_category" />;
      case "equipment_statuses":
        return <DictionariesSettings type="equipment_status" />;
      default:
        return <SystemSettings />;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
          <SettingsIcon className="h-8 w-8 mr-3" />
          Настройки системы
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Управление параметрами системы, зданиями и справочниками
        </p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">{renderTabContent()}</div>
    </div>
  );
};
