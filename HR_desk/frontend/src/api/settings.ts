const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";

export interface BrandingSettings {
  site_title: string;
  site_favicon: string;
}

export interface SystemSetting {
  id: number;
  setting_key: string;
  setting_value: string | null;
  setting_type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const settingsService = {
  async getBranding(): Promise<BrandingSettings> {
    const response = await fetch(`${API_BASE}/settings/branding`);
    if (!response.ok) {
      throw new Error("Failed to fetch branding settings");
    }
    return response.json();
  },

  async getAllSettings(): Promise<SystemSetting[]> {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/settings`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error("Failed to fetch settings");
    }
    return response.json();
  },

  async updateSetting(key: string, value: string): Promise<SystemSetting> {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/settings/${key}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ value }),
    });
    if (!response.ok) {
      throw new Error("Failed to update setting");
    }
    return response.json();
  },

  async uploadFavicon(file: File): Promise<{ url: string }> {
    const token = localStorage.getItem("token");
    const formData = new FormData();
    formData.append("favicon", file);

    const response = await fetch(`${API_BASE}/settings/upload-favicon`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || "Failed to upload favicon");
    }
    return response.json();
  },

  async deleteFavicon(): Promise<void> {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE}/settings/favicon`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error("Failed to delete favicon");
    }
  },
};
