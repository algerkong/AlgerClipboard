import { create } from "zustand";
import {
  getSetting,
  updateSetting,
  setAutoStart as setAutoStartApi,
  getAutoStart,
  updateToggleShortcut,
} from "@/services/settingsService";
import { listen } from "@tauri-apps/api/event";

type Theme = "light" | "dark" | "system";
export type UIScale = "xs" | "sm" | "md" | "lg" | "xl";
export type FontFamily = "system" | "microsoft-yahei" | "noto-sans" | "mono";
export type ButtonPosition = "left" | "right";

const UI_SCALE_MAP: Record<UIScale, string> = {
  xs: "12px",
  sm: "13px",
  md: "14px",
  lg: "15px",
  xl: "16px",
};

const FONT_FAMILY_MAP: Record<FontFamily, string> = {
  system:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  "microsoft-yahei": '"Microsoft YaHei", "微软雅黑", sans-serif',
  "noto-sans": '"Noto Sans SC", "Noto Sans", sans-serif',
  mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
};

function applyUIScale(scale: UIScale) {
  document.documentElement.style.setProperty(
    "--app-font-size",
    UI_SCALE_MAP[scale],
  );
}

function applyFontFamily(family: FontFamily) {
  document.documentElement.style.setProperty(
    "--app-font-family",
    FONT_FAMILY_MAP[family],
  );
}

// Migrate old font_size values to new ui_scale values
const FONT_SIZE_MIGRATION: Record<string, UIScale> = {
  small: "xs",
  medium: "sm",
  large: "md",
};

interface SettingsState {
  theme: Theme;
  maxHistory: number;
  expireDays: number; // 0 = never expire
  autoStart: boolean;
  pasteAndClose: boolean;
  locale: string;
  uiScale: UIScale;
  fontFamily: FontFamily;
  toggleShortcut: string;
  autoCheckUpdate: boolean;
  autoDownloadUpdate: boolean;
  buttonPosition: ButtonPosition;
  defaultBrowser: string;
  isPinned: boolean; // non-persisted, controls auto-hide on blur

  loadSettings: () => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setMaxHistory: (max: number) => Promise<void>;
  setExpireDays: (days: number) => Promise<void>;
  setAutoStart: (enabled: boolean) => Promise<void>;
  setPasteAndClose: (enabled: boolean) => Promise<void>;
  setLocale: (locale: string) => Promise<void>;
  setUIScale: (scale: UIScale) => Promise<void>;
  setFontFamily: (family: FontFamily) => Promise<void>;
  setToggleShortcut: (shortcut: string) => Promise<void>;
  setAutoCheckUpdate: (enabled: boolean) => Promise<void>;
  setAutoDownloadUpdate: (enabled: boolean) => Promise<void>;
  setButtonPosition: (position: ButtonPosition) => Promise<void>;
  setDefaultBrowser: (browser: string) => Promise<void>;
  setIsPinned: (pinned: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "dark",
  maxHistory: 500,
  expireDays: 0,
  autoStart: false,
  pasteAndClose: true,
  locale: "zh-CN",
  uiScale: "md",
  fontFamily: "system",
  toggleShortcut: "CmdOrCtrl+Shift+V",
  autoCheckUpdate: true,
  autoDownloadUpdate: false,
  buttonPosition: "right",
  defaultBrowser: "system",
  isPinned: true,

  loadSettings: async () => {
    try {
      const [
        theme,
        maxHistory,
        expireDays,
        pasteAndClose,
        locale,
        uiScale,
        oldFontSize,
        fontFamily,
        autoStartEnabled,
        toggleShortcut,
        autoCheckUpdate,
        autoDownloadUpdate,
        buttonPosition,
        defaultBrowser,
      ] = await Promise.all([
        getSetting("theme"),
        getSetting("max_history"),
        getSetting("expire_days"),
        getSetting("paste_and_close"),
        getSetting("locale"),
        getSetting("ui_scale"),
        getSetting("font_size"),
        getSetting("font_family"),
        getAutoStart(),
        getSetting("toggle_shortcut"),
        getSetting("auto_check_update"),
        getSetting("auto_download_update"),
        getSetting("button_position"),
        getSetting("default_browser"),
      ]);

      // Migrate old font_size to ui_scale
      let scale: UIScale = "md";
      if (uiScale && uiScale in UI_SCALE_MAP) {
        scale = uiScale as UIScale;
      } else if (oldFontSize && oldFontSize in FONT_SIZE_MIGRATION) {
        scale = FONT_SIZE_MIGRATION[oldFontSize];
        // Persist the migrated value
        updateSetting("ui_scale", scale).catch(() => {});
      }

      const ff = (fontFamily as FontFamily) || "system";

      applyUIScale(scale);
      applyFontFamily(ff);

      set({
        theme: (theme as Theme) ?? "dark",
        maxHistory: maxHistory ? parseInt(maxHistory, 10) : 500,
        expireDays: expireDays ? parseInt(expireDays, 10) : 0,
        autoStart: autoStartEnabled,
        pasteAndClose: pasteAndClose !== "false",
        locale: locale ?? "zh-CN",
        uiScale: scale,
        fontFamily: ff,
        toggleShortcut: toggleShortcut?.trim() || "CmdOrCtrl+Shift+V",
        autoCheckUpdate: autoCheckUpdate !== "false",
        autoDownloadUpdate: autoDownloadUpdate === "true",
        buttonPosition: (buttonPosition as ButtonPosition) || "right",
        defaultBrowser: defaultBrowser || "system",
      });
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  },

  setTheme: async (theme: Theme) => {
    set({ theme });
    try {
      await updateSetting("theme", theme);
    } catch (err) {
      console.error("Failed to save theme:", err);
    }
  },

  setMaxHistory: async (max: number) => {
    set({ maxHistory: max });
    try {
      await updateSetting("max_history", String(max));
    } catch (err) {
      console.error("Failed to save max_history:", err);
    }
  },

  setExpireDays: async (days: number) => {
    set({ expireDays: days });
    try {
      await updateSetting("expire_days", String(days));
    } catch (err) {
      console.error("Failed to save expire_days:", err);
    }
  },

  setAutoStart: async (enabled: boolean) => {
    set({ autoStart: enabled });
    try {
      await setAutoStartApi(enabled);
    } catch (err) {
      console.error("Failed to save auto_start:", err);
    }
  },

  setPasteAndClose: async (enabled: boolean) => {
    set({ pasteAndClose: enabled });
    try {
      await updateSetting("paste_and_close", String(enabled));
    } catch (err) {
      console.error("Failed to save paste_and_close:", err);
    }
  },

  setLocale: async (locale: string) => {
    set({ locale });
    try {
      await updateSetting("locale", locale);
    } catch (err) {
      console.error("Failed to save locale:", err);
    }
  },

  setUIScale: async (scale: UIScale) => {
    applyUIScale(scale);
    set({ uiScale: scale });
    try {
      await updateSetting("ui_scale", scale);
    } catch (err) {
      console.error("Failed to save ui_scale:", err);
    }
  },

  setFontFamily: async (family: FontFamily) => {
    applyFontFamily(family);
    set({ fontFamily: family });
    try {
      await updateSetting("font_family", family);
    } catch (err) {
      console.error("Failed to save font_family:", err);
    }
  },

  setToggleShortcut: async (shortcut: string) => {
    const normalized = shortcut.trim();
    if (!normalized) return;
    const prev = useSettingsStore.getState().toggleShortcut;
    set({ toggleShortcut: normalized });
    try {
      await updateToggleShortcut(normalized);
    } catch (err) {
      set({ toggleShortcut: prev });
      console.error("Failed to save toggle_shortcut:", err);
      throw err;
    }
  },

  setAutoCheckUpdate: async (enabled: boolean) => {
    set({ autoCheckUpdate: enabled });
    try {
      await updateSetting("auto_check_update", String(enabled));
    } catch (err) {
      console.error("Failed to save auto_check_update:", err);
    }
  },

  setAutoDownloadUpdate: async (enabled: boolean) => {
    set({ autoDownloadUpdate: enabled });
    try {
      await updateSetting("auto_download_update", String(enabled));
    } catch (err) {
      console.error("Failed to save auto_download_update:", err);
    }
  },

  setButtonPosition: async (position: ButtonPosition) => {
    set({ buttonPosition: position });
    try {
      await updateSetting("button_position", position);
    } catch (err) {
      console.error("Failed to save button_position:", err);
    }
  },

  setDefaultBrowser: async (browser: string) => {
    set({ defaultBrowser: browser });
    try {
      await updateSetting("default_browser", browser);
    } catch (err) {
      console.error("Failed to save default_browser:", err);
    }
  },

  setIsPinned: (pinned: boolean) => {
    set({ isPinned: pinned });
  },
}));

// Listen for settings-changed event from sync
listen("settings-changed", () => {
  useSettingsStore.getState().loadSettings();
}).catch(() => {});
