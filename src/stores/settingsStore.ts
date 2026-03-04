import { create } from "zustand";
import {
  getSetting,
  updateSetting,
} from "@/services/settingsService";

type Theme = "light" | "dark" | "system";

interface SettingsState {
  theme: Theme;
  maxHistory: number;
  autoStart: boolean;
  pasteAndClose: boolean;

  loadSettings: () => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setMaxHistory: (max: number) => Promise<void>;
  setAutoStart: (enabled: boolean) => Promise<void>;
  setPasteAndClose: (enabled: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "dark",
  maxHistory: 500,
  autoStart: false,
  pasteAndClose: true,

  loadSettings: async () => {
    try {
      const [theme, maxHistory, autoStart, pasteAndClose] = await Promise.all([
        getSetting("theme"),
        getSetting("max_history"),
        getSetting("auto_start"),
        getSetting("paste_and_close"),
      ]);

      set({
        theme: (theme as Theme) ?? "dark",
        maxHistory: maxHistory ? parseInt(maxHistory, 10) : 500,
        autoStart: autoStart === "true",
        pasteAndClose: pasteAndClose !== "false",
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
      await updateSetting("auto_start", String(enabled));
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
}));
