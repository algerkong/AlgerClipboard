import { create } from "zustand";
import {
  getSetting,
  updateSetting,
  setAutoStart as setAutoStartApi,
  getAutoStart,
} from "@/services/settingsService";

type Theme = "light" | "dark" | "system";
export type FontSize = "small" | "medium" | "large";

const FONT_SIZE_MAP: Record<FontSize, string> = {
  small: "12px",
  medium: "13px",
  large: "14px",
};

function applyFontSize(size: FontSize) {
  document.documentElement.style.setProperty("--app-font-size", FONT_SIZE_MAP[size]);
}

interface SettingsState {
  theme: Theme;
  maxHistory: number;
  autoStart: boolean;
  pasteAndClose: boolean;
  locale: string;
  fontSize: FontSize;
  isPinned: boolean; // non-persisted, controls auto-hide on blur

  loadSettings: () => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setMaxHistory: (max: number) => Promise<void>;
  setAutoStart: (enabled: boolean) => Promise<void>;
  setPasteAndClose: (enabled: boolean) => Promise<void>;
  setLocale: (locale: string) => Promise<void>;
  setFontSize: (size: FontSize) => Promise<void>;
  setIsPinned: (pinned: boolean) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "dark",
  maxHistory: 500,
  autoStart: false,
  pasteAndClose: true,
  locale: "zh-CN",
  fontSize: "medium" as FontSize,
  isPinned: true,

  loadSettings: async () => {
    try {
      const [theme, maxHistory, pasteAndClose, locale, fontSize, autoStartEnabled] = await Promise.all([
        getSetting("theme"),
        getSetting("max_history"),
        getSetting("paste_and_close"),
        getSetting("locale"),
        getSetting("font_size"),
        getAutoStart(),
      ]);

      const fs = (fontSize as FontSize) || "medium";
      applyFontSize(fs);

      set({
        theme: (theme as Theme) ?? "dark",
        maxHistory: maxHistory ? parseInt(maxHistory, 10) : 500,
        autoStart: autoStartEnabled,
        pasteAndClose: pasteAndClose !== "false",
        locale: locale ?? "zh-CN",
        fontSize: fs,
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

  setFontSize: async (size: FontSize) => {
    applyFontSize(size);
    set({ fontSize: size });
    try {
      await updateSetting("font_size", size);
    } catch (err) {
      console.error("Failed to save font_size:", err);
    }
  },

  setIsPinned: (pinned: boolean) => {
    set({ isPinned: pinned });
  },
}));
