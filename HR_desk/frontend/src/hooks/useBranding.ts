import { useState, useEffect } from "react";
import { settingsService, BrandingSettings } from "../api/settings";

const DEFAULT_BRANDING: BrandingSettings = {
  site_title: "HR Desk",
  site_favicon: "",
};

function getBaseUrl(): string {
  return window.location.origin;
}

export function updateFavicon(faviconUrl: string): void {
  let link: HTMLLinkElement | null =
    document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  if (faviconUrl) {
    const baseUrl = getBaseUrl();
    link.href = `${baseUrl}${faviconUrl}`;
  } else {
    link.href = "/vite.svg";
  }
}

export function applyBranding(branding: BrandingSettings): void {
  if (branding.site_title) {
    document.title = branding.site_title;
  }
  updateFavicon(branding.site_favicon);
}

export function useBranding() {
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const data = await settingsService.getBranding();
        setBranding(data);
        applyBranding(data);
      } catch (error) {
        console.error("Failed to load branding:", error);
        applyBranding(DEFAULT_BRANDING);
      } finally {
        setLoading(false);
      }
    };
    loadBranding();
  }, []);

  const refreshBranding = async () => {
    try {
      const data = await settingsService.getBranding();
      setBranding(data);
      applyBranding(data);
    } catch (error) {
      console.error("Failed to refresh branding:", error);
    }
  };

  return { branding, loading, refreshBranding };
}
