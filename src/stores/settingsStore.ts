import { create } from "zustand";
import {
  getSetting,
  updateSetting,
  setAutoStart as setAutoStartApi,
  getAutoStart,
  updateToggleShortcut,
  updateIncognitoShortcut,
} from "@/services/settingsService";
import { listen } from "@tauri-apps/api/event";
import {
  DEFAULT_RICH_TEXT_DETAIL_MODE,
  DEFAULT_RICH_TEXT_PREVIEW_OPTIONS,
  parseRichTextPreviewOptions,
  serializeRichTextPreviewOptions,
  type RichTextDetailMode,
  type RichTextPreviewOptions,
} from "@/lib/richText";

type Theme = "light" | "dark" | "system";
export type UIScale = "xs" | "sm" | "md" | "lg" | "xl";
export type FontFamily = "system" | "microsoft-yahei" | "noto-sans" | "mono";
export type ButtonPosition = "left" | "right";
export type ThemeColorPreset = "indigo" | "ocean" | "amber" | "rose" | "violet" | "emerald" | "cyan" | "slate" | "crimson" | "custom";

const THEME_COLOR_PRESET_MAP: Record<Exclude<ThemeColorPreset, "custom">, string> = {
  indigo: "#4f46e5",
  ocean: "#2563eb",
  amber: "#d97706",
  rose: "#e11d48",
  violet: "#7c3aed",
  emerald: "#10b981",
  cyan: "#06b6d4",
  slate: "#475569",
  crimson: "#9f1239",
};

const UI_SCALE_MAP: Record<
  UIScale,
  {
    fontSize: string;
    tabFontSize: string;
    tabIconSize: string;
    tabPaddingX: string;
    tabPaddingY: string;
    tabGap: string;
  }
> = {
  xs: {
    fontSize: "12px",
    tabFontSize: "11px",
    tabIconSize: "11px",
    tabPaddingX: "7px",
    tabPaddingY: "4px",
    tabGap: "4px",
  },
  sm: {
    fontSize: "14px",
    tabFontSize: "12px",
    tabIconSize: "12px",
    tabPaddingX: "8px",
    tabPaddingY: "5px",
    tabGap: "4px",
  },
  md: {
    fontSize: "16px",
    tabFontSize: "13px",
    tabIconSize: "13px",
    tabPaddingX: "10px",
    tabPaddingY: "6px",
    tabGap: "5px",
  },
  lg: {
    fontSize: "18px",
    tabFontSize: "15px",
    tabIconSize: "14px",
    tabPaddingX: "11px",
    tabPaddingY: "7px",
    tabGap: "6px",
  },
  xl: {
    fontSize: "20px",
    tabFontSize: "17px",
    tabIconSize: "16px",
    tabPaddingX: "13px",
    tabPaddingY: "8px",
    tabGap: "6px",
  },
};

const FONT_FAMILY_MAP: Record<FontFamily, string> = {
  system:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  "microsoft-yahei": '"Microsoft YaHei", "微软雅黑", sans-serif',
  "noto-sans": '"Noto Sans SC", "Noto Sans", sans-serif',
  mono: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
};

function applyUIScale(scale: UIScale) {
  const tokens = UI_SCALE_MAP[scale];
  document.documentElement.style.setProperty(
    "--app-font-size",
    tokens.fontSize,
  );
  document.documentElement.style.setProperty("--app-tab-font-size", tokens.tabFontSize);
  document.documentElement.style.setProperty("--app-tab-icon-size", tokens.tabIconSize);
  document.documentElement.style.setProperty("--app-tab-px", tokens.tabPaddingX);
  document.documentElement.style.setProperty("--app-tab-py", tokens.tabPaddingY);
  document.documentElement.style.setProperty("--app-tab-gap", tokens.tabGap);
}

function applyFontFamily(family: FontFamily) {
  document.documentElement.style.setProperty(
    "--app-font-family",
    FONT_FAMILY_MAP[family],
  );
}

function normalizeThemeColor(value: string | null | undefined): string {
  const raw = value?.trim() ?? "";
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
    return raw.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [, r, g, b] = raw;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return THEME_COLOR_PRESET_MAP.indigo;
}

function resolveThemeColor(preset: ThemeColorPreset, customColor: string): string {
  if (preset === "custom") {
    return normalizeThemeColor(customColor);
  }

  return THEME_COLOR_PRESET_MAP[preset];
}

function applyThemeColor(preset: ThemeColorPreset, customColor: string) {
  const resolvedColor = resolveThemeColor(preset, customColor);
  const el = document.documentElement;
  // Remove first to break potential WebKit color-mix() caching
  el.style.removeProperty("--theme-accent-source");
  // Force synchronous reflow so the removal is processed
  void el.offsetHeight;
  // Set the new value
  el.style.setProperty("--theme-accent-source", resolvedColor);
  // Force another reflow to ensure all color-mix() expressions recompute
  void el.offsetHeight;
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
  themeColorPreset: ThemeColorPreset;
  themeColorCustom: string;
  toggleShortcut: string;
  incognitoShortcut: string;
  autoCheckUpdate: boolean;
  autoDownloadUpdate: boolean;
  systemNotificationsEnabled: boolean;
  buttonPosition: ButtonPosition;
  defaultBrowser: string;
  richTextPreview: RichTextPreviewOptions;
  richTextDetailMode: RichTextDetailMode;
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
  setThemeColorPreset: (preset: ThemeColorPreset) => Promise<void>;
  setThemeColorCustom: (color: string) => Promise<void>;
  setToggleShortcut: (shortcut: string) => Promise<void>;
  setIncognitoShortcut: (shortcut: string) => Promise<void>;
  setAutoCheckUpdate: (enabled: boolean) => Promise<void>;
  setAutoDownloadUpdate: (enabled: boolean) => Promise<void>;
  setSystemNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setButtonPosition: (position: ButtonPosition) => Promise<void>;
  setDefaultBrowser: (browser: string) => Promise<void>;
  setRichTextPreviewEnabled: (enabled: boolean) => Promise<void>;
  setRichTextPreviewOption: (
    key: Exclude<keyof RichTextPreviewOptions, "enabled">,
    enabled: boolean,
  ) => Promise<void>;
  setRichTextDetailMode: (mode: RichTextDetailMode) => Promise<void>;
  setIsPinned: (pinned: boolean) => void;
}

// Read cached theme from localStorage to match the inline script in index.html,
// preventing a flash of wrong theme before settings load from SQLite.
const cachedTheme = (localStorage.getItem("theme") as Theme) || "dark";

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: cachedTheme,
  maxHistory: 500,
  expireDays: 0,
  autoStart: false,
  pasteAndClose: true,
  locale: "zh-CN",
  uiScale: "lg",
  fontFamily: "system",
  themeColorPreset: "indigo",
  themeColorCustom: THEME_COLOR_PRESET_MAP.indigo,
  toggleShortcut: "CmdOrCtrl+Shift+V",
  incognitoShortcut: "",
  autoCheckUpdate: true,
  autoDownloadUpdate: false,
  systemNotificationsEnabled: true,
  buttonPosition: "right",
  defaultBrowser: "system",
  richTextPreview: DEFAULT_RICH_TEXT_PREVIEW_OPTIONS,
  richTextDetailMode: DEFAULT_RICH_TEXT_DETAIL_MODE,
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
        themeColorPreset,
        themeColorCustom,
        autoStartEnabled,
        toggleShortcut,
        incognitoShortcut,
        autoCheckUpdate,
        autoDownloadUpdate,
        systemNotificationsEnabled,
        buttonPosition,
        defaultBrowser,
        richTextPreview,
        richTextDetailMode,
      ] = await Promise.all([
        getSetting("theme"),
        getSetting("max_history"),
        getSetting("expire_days"),
        getSetting("paste_and_close"),
        getSetting("locale"),
        getSetting("ui_scale"),
        getSetting("font_size"),
        getSetting("font_family"),
        getSetting("theme_color_preset"),
        getSetting("theme_color_custom"),
        getAutoStart(),
        getSetting("toggle_shortcut"),
        getSetting("incognito_shortcut"),
        getSetting("auto_check_update"),
        getSetting("auto_download_update"),
        getSetting("system_notifications_enabled"),
        getSetting("button_position"),
        getSetting("default_browser"),
        getSetting("rich_text_preview_options"),
        getSetting("rich_text_detail_mode"),
      ]);

      // Migrate old font_size to ui_scale
      let scale: UIScale = "lg";
      if (uiScale && uiScale in UI_SCALE_MAP) {
        scale = uiScale as UIScale;
      } else if (oldFontSize && oldFontSize in FONT_SIZE_MIGRATION) {
        scale = FONT_SIZE_MIGRATION[oldFontSize];
        // Persist the migrated value
        updateSetting("ui_scale", scale).catch(() => {});
      }

      const ff = (fontFamily as FontFamily) || "system";
      const resolvedThemeColorPreset =
        themeColorPreset && (themeColorPreset === "custom" || themeColorPreset in THEME_COLOR_PRESET_MAP)
          ? (themeColorPreset as ThemeColorPreset)
          : "indigo";
      const resolvedThemeColorCustom = normalizeThemeColor(themeColorCustom);
      const parsedRichTextPreview = parseRichTextPreviewOptions(richTextPreview);
      const resolvedDetailMode =
        richTextDetailMode === "full" ? "full" : DEFAULT_RICH_TEXT_DETAIL_MODE;

      applyUIScale(scale);
      applyFontFamily(ff);
      applyThemeColor(resolvedThemeColorPreset, resolvedThemeColorCustom);

      // Cache theme and accent to localStorage for instant application on next window open
      const resolvedTheme = (theme as Theme) ?? "dark";
      localStorage.setItem("theme", resolvedTheme);
      const accentColor = resolvedThemeColorPreset === "custom"
        ? resolvedThemeColorCustom
        : THEME_COLOR_PRESET_MAP[resolvedThemeColorPreset] ?? THEME_COLOR_PRESET_MAP.indigo;
      localStorage.setItem("theme-accent", accentColor);
      // Cache UI scale and font family for instant application on next window open
      localStorage.setItem("ui-scale", scale);
      localStorage.setItem("font-family", ff);

      set({
        theme: resolvedTheme,
        maxHistory: maxHistory ? parseInt(maxHistory, 10) : 500,
        expireDays: expireDays ? parseInt(expireDays, 10) : 0,
        autoStart: autoStartEnabled,
        pasteAndClose: pasteAndClose !== "false",
        locale: locale ?? "zh-CN",
        uiScale: scale,
        fontFamily: ff,
        themeColorPreset: resolvedThemeColorPreset,
        themeColorCustom: resolvedThemeColorCustom,
        toggleShortcut: toggleShortcut?.trim() || "CmdOrCtrl+Shift+V",
        incognitoShortcut: incognitoShortcut?.trim() || "",
        autoCheckUpdate: autoCheckUpdate !== "false",
        autoDownloadUpdate: autoDownloadUpdate === "true",
        systemNotificationsEnabled: systemNotificationsEnabled !== "false",
        buttonPosition: (buttonPosition as ButtonPosition) || "right",
        defaultBrowser: defaultBrowser || "system",
        richTextPreview: parsedRichTextPreview,
        richTextDetailMode: resolvedDetailMode,
      });
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  },

  setTheme: async (theme: Theme) => {
    set({ theme });
    localStorage.setItem("theme", theme);
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
    localStorage.setItem("ui-scale", scale);
    try {
      await updateSetting("ui_scale", scale);
    } catch (err) {
      console.error("Failed to save ui_scale:", err);
    }
  },

  setFontFamily: async (family: FontFamily) => {
    applyFontFamily(family);
    set({ fontFamily: family });
    localStorage.setItem("font-family", family);
    try {
      await updateSetting("font_family", family);
    } catch (err) {
      console.error("Failed to save font_family:", err);
    }
  },

  setThemeColorPreset: async (preset: ThemeColorPreset) => {
    const nextCustom = useSettingsStore.getState().themeColorCustom;
    applyThemeColor(preset, nextCustom);
    set({ themeColorPreset: preset });
    const accentColor = preset === "custom" ? nextCustom : THEME_COLOR_PRESET_MAP[preset] ?? THEME_COLOR_PRESET_MAP.indigo;
    localStorage.setItem("theme-accent", accentColor);
    try {
      await updateSetting("theme_color_preset", preset);
    } catch (err) {
      console.error("Failed to save theme_color_preset:", err);
    }
  },

  setThemeColorCustom: async (color: string) => {
    const normalized = normalizeThemeColor(color);
    applyThemeColor("custom", normalized);
    set({ themeColorPreset: "custom", themeColorCustom: normalized });
    localStorage.setItem("theme-accent", normalized);
    try {
      await Promise.all([
        updateSetting("theme_color_preset", "custom"),
        updateSetting("theme_color_custom", normalized),
      ]);
    } catch (err) {
      console.error("Failed to save theme_color_custom:", err);
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

  setIncognitoShortcut: async (shortcut: string) => {
    const normalized = shortcut.trim();
    const prev = useSettingsStore.getState().incognitoShortcut;
    set({ incognitoShortcut: normalized });
    try {
      await updateIncognitoShortcut(normalized);
    } catch (err) {
      set({ incognitoShortcut: prev });
      console.error("Failed to save incognito_shortcut:", err);
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

  setSystemNotificationsEnabled: async (enabled: boolean) => {
    set({ systemNotificationsEnabled: enabled });
    try {
      await updateSetting("system_notifications_enabled", String(enabled));
    } catch (err) {
      console.error("Failed to save system_notifications_enabled:", err);
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

  setRichTextPreviewEnabled: async (enabled: boolean) => {
    const nextOptions = {
      ...useSettingsStore.getState().richTextPreview,
      enabled,
    };
    set({ richTextPreview: nextOptions });
    try {
      await updateSetting(
        "rich_text_preview_options",
        serializeRichTextPreviewOptions(nextOptions),
      );
    } catch (err) {
      console.error("Failed to save rich_text_preview_options:", err);
    }
  },

  setRichTextPreviewOption: async (key, enabled) => {
    const nextOptions = {
      ...useSettingsStore.getState().richTextPreview,
      [key]: enabled,
    };
    set({ richTextPreview: nextOptions });
    try {
      await updateSetting(
        "rich_text_preview_options",
        serializeRichTextPreviewOptions(nextOptions),
      );
    } catch (err) {
      console.error("Failed to save rich_text_preview_options:", err);
    }
  },

  setRichTextDetailMode: async (mode) => {
    set({ richTextDetailMode: mode });
    try {
      await updateSetting("rich_text_detail_mode", mode);
    } catch (err) {
      console.error("Failed to save rich_text_detail_mode:", err);
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
