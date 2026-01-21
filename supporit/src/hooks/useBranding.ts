import { useEffect, useState } from "react";
import { settingsService } from "../services/settings.service";
import type { BrandingSettings } from "../services/settings.service";

const DEFAULT_BRANDING: BrandingSettings = {
  site_title: "SuppOrIT",
  site_favicon: "",
};

export const useBranding = () => {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const { data } = await settingsService.getBranding();
        setBranding(data);

        // Применяем настройки
        applyBranding(data);
      } catch (error) {
        console.error("Ошибка загрузки настроек брендинга:", error);
        // Применяем дефолтные настройки
        applyBranding(DEFAULT_BRANDING);
      } finally {
        setLoading(false);
      }
    };

    loadBranding();
  }, []);

  return { branding, loading };
};

// Функция для применения настроек брендинга
export const applyBranding = (branding: BrandingSettings) => {
  // Устанавливаем title
  if (branding.site_title) {
    document.title = branding.site_title;
  }

  // Устанавливаем favicon
  updateFavicon(branding.site_favicon);
};

// Функция для обновления favicon
export const updateFavicon = (faviconUrl: string) => {
  let link: HTMLLinkElement | null =
    document.querySelector("link[rel*='icon']");

  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.getElementsByTagName("head")[0].appendChild(link);
  }

  if (faviconUrl) {
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
    const baseUrl = apiUrl.replace("/api", "");
    link.href = `${baseUrl}${faviconUrl}`;
  } else {
    link.href = "/vite.svg";
  }
};
