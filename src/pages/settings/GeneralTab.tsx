import { useEffect, useState } from "react";
import {
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import {
  useSettingsStore,
  type UIScale,
  type FontFamily,
  type ButtonPosition,
  type ThemeColorPreset,
} from "@/stores/settingsStore";
import {
  checkForUpdates,
  downloadAndInstall,
} from "@/services/updateService";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { usePlatform } from "@/contexts/PlatformContext";
import { invoke } from "@tauri-apps/api/core";
import {
  Toggle,
  MODIFIER_KEYS,
  buildShortcutFromKeyboardEvent,
  languages,
  type Theme,
} from "./shared";

/* ─── General Tab ─── */
export function GeneralTab() {
  const { t, i18n } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const maxHistory = useSettingsStore((s) => s.maxHistory);
  const expireDays = useSettingsStore((s) => s.expireDays);
  const pasteAndClose = useSettingsStore((s) => s.pasteAndClose);
  const autoStart = useSettingsStore((s) => s.autoStart);
  const locale = useSettingsStore((s) => s.locale);
  const uiScale = useSettingsStore((s) => s.uiScale);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const themeColorPreset = useSettingsStore((s) => s.themeColorPreset);
  const themeColorCustom = useSettingsStore((s) => s.themeColorCustom);
  const toggleShortcut = useSettingsStore((s) => s.toggleShortcut);
  const autoCheckUpdate = useSettingsStore((s) => s.autoCheckUpdate);
  const autoDownloadUpdate = useSettingsStore((s) => s.autoDownloadUpdate);
  const systemNotificationsEnabled = useSettingsStore((s) => s.systemNotificationsEnabled);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setMaxHistory = useSettingsStore((s) => s.setMaxHistory);
  const setExpireDays = useSettingsStore((s) => s.setExpireDays);
  const setPasteAndClose = useSettingsStore((s) => s.setPasteAndClose);
  const setAutoStart = useSettingsStore((s) => s.setAutoStart);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const setUIScale = useSettingsStore((s) => s.setUIScale);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const setThemeColorPreset = useSettingsStore((s) => s.setThemeColorPreset);
  const setThemeColorCustom = useSettingsStore((s) => s.setThemeColorCustom);
  const setToggleShortcut = useSettingsStore((s) => s.setToggleShortcut);
  const setAutoCheckUpdate = useSettingsStore((s) => s.setAutoCheckUpdate);
  const setAutoDownloadUpdate = useSettingsStore((s) => s.setAutoDownloadUpdate);
  const setSystemNotificationsEnabled = useSettingsStore((s) => s.setSystemNotificationsEnabled);
  const buttonPosition = useSettingsStore((s) => s.buttonPosition);
  const setButtonPosition = useSettingsStore((s) => s.setButtonPosition);
  const defaultBrowser = useSettingsStore((s) => s.defaultBrowser);
  const setDefaultBrowser = useSettingsStore((s) => s.setDefaultBrowser);
  const platform = usePlatform();
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [previewCloseShortcut, setPreviewCloseShortcutState] = useState("Escape");
  const [isRecordingCloseShortcut, setIsRecordingCloseShortcut] = useState(false);

  useEffect(() => {
    if (!isRecordingShortcut) {
      return;
    }

    const handleRecordShortcut = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setIsRecordingShortcut(false);
        return;
      }

      if (MODIFIER_KEYS.has(event.key)) {
        return;
      }

      const nextShortcut = buildShortcutFromKeyboardEvent(event);
      if (!nextShortcut) {
        toast.error(t("settings.shortcutInvalid"));
        return;
      }

      setIsRecordingShortcut(false);
      setToggleShortcut(nextShortcut)
        .then(() => {
          toast.success(t("settings.shortcutSaved"));
        })
        .catch(() => {
          toast.error(t("settings.shortcutInvalid"));
        });
    };

    window.addEventListener("keydown", handleRecordShortcut, true);
    return () => {
      window.removeEventListener("keydown", handleRecordShortcut, true);
    };
  }, [isRecordingShortcut, setToggleShortcut, t]);

  useEffect(() => {
    invoke<string | null>("get_settings", { key: "preview_close_shortcut" }).then((val) => {
      if (val && val !== " " && !(val.length === 1 && /[a-zA-Z0-9]/.test(val))) {
        setPreviewCloseShortcutState(val);
      } else if (val) {
        // Invalid saved key, reset to Escape
        invoke("update_settings", { key: "preview_close_shortcut", value: "Escape" }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isRecordingCloseShortcut) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Allow Escape to cancel recording (unless current shortcut is already Escape)
      if (e.key === "Escape" && previewCloseShortcut !== "Escape") {
        setIsRecordingCloseShortcut(false);
        return;
      }
      const key = e.key;
      // Reject keys that conflict with text editing
      if (key === " " || key.length === 1 && /[a-zA-Z0-9]/.test(key)) {
        toast.error(t("settings.shortcutInvalid"));
        setIsRecordingCloseShortcut(false);
        return;
      }
      setIsRecordingCloseShortcut(false);
      setPreviewCloseShortcutState(key);
      invoke("update_settings", { key: "preview_close_shortcut", value: key })
        .then(() => toast.success(t("settings.shortcutSaved")))
        .catch(() => toast.error(t("settings.shortcutInvalid")));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isRecordingCloseShortcut, previewCloseShortcut, t]);

  const themes: { value: Theme; labelKey: string; icon: React.ReactNode }[] = [
    {
      value: "light",
      labelKey: "settings.light",
      icon: <Sun className="w-3.5 h-3.5" />,
    },
    {
      value: "dark",
      labelKey: "settings.dark",
      icon: <Moon className="w-3.5 h-3.5" />,
    },
    {
      value: "system",
      labelKey: "settings.auto",
      icon: <Monitor className="w-3.5 h-3.5" />,
    },
  ];
  const themeColors: {
    value: Exclude<ThemeColorPreset, "custom">;
    labelKey: string;
    color: string;
  }[] = [
    { value: "indigo", labelKey: "settings.themeColor_indigo", color: "#4f46e5" },
    { value: "ocean", labelKey: "settings.themeColor_ocean", color: "#2563eb" },
    { value: "cyan", labelKey: "settings.themeColor_cyan", color: "#06b6d4" },
    { value: "emerald", labelKey: "settings.themeColor_emerald", color: "#10b981" },
    { value: "amber", labelKey: "settings.themeColor_amber", color: "#d97706" },
    { value: "rose", labelKey: "settings.themeColor_rose", color: "#e11d48" },
    { value: "crimson", labelKey: "settings.themeColor_crimson", color: "#9f1239" },
    { value: "violet", labelKey: "settings.themeColor_violet", color: "#7c3aed" },
    { value: "slate", labelKey: "settings.themeColor_slate", color: "#475569" },
  ];

  const handleLocaleChange = (newLocale: string) => {
    setLocale(newLocale);
    i18n.changeLanguage(newLocale);
  };

  return (
    <div className="space-y-5">
      {/* Language */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.language")}
        </label>
        <div className="flex gap-1.5 mt-2">
          {languages.map((lang) => (
            <button
              key={lang.value}
              onClick={() => handleLocaleChange(lang.value)}
              className={cn(
                "flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors",
                locale === lang.value
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {lang.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs2 text-muted-foreground/70">
          {t("settings.languageDesc")}
        </p>
      </section>

      {/* Theme */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.theme")}
        </label>
        <div className="flex gap-1.5 mt-2">
          {themes.map((themeItem) => (
            <button
              key={themeItem.value}
              onClick={() => setTheme(themeItem.value)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                theme === themeItem.value
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {themeItem.icon}
              {t(themeItem.labelKey)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
            {t("settings.themeColor")}
          </label>
          <div className="flex items-center gap-1.5 min-w-0 shrink-0">
             <div className="flex items-center gap-2 px-2 py-1 bg-card/60 border border-border/40 rounded-lg">
                <span
                  title={t("settings.themeColor_custom")}
                  className={cn(
                    "flex items-center justify-center p-0.5 rounded-full outline-none transition-all cursor-pointer ring-offset-2 ring-offset-background",
                    themeColorPreset === "custom" ? "ring-2 ring-primary scale-110" : "hover:scale-110"
                  )}
                  onClick={() => setThemeColorPreset("custom")}
                >
                  <span
                    className="h-4 w-4 rounded-full border border-black/10 shadow-inner"
                    style={{ background: `conic-gradient(from 180deg at 50% 50%, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff, #8000ff, #ff0080, #ff0000)` }}
                  />
                </span>
                <input
                  type="color"
                  value={themeColorCustom}
                  onChange={(e) => {
                    setThemeColorCustom(e.target.value);
                    setThemeColorPreset("custom");
                  }}
                  className="h-6 w-8 cursor-pointer rounded border border-border/60 bg-transparent p-0 flex-shrink-0"
                  aria-label={t("settings.themeColorPicker")}
                />
             </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {themeColors.map((themeColor) => {
            const active = themeColorPreset === themeColor.value;
            return (
              <button
                key={themeColor.value}
                onClick={() => setThemeColorPreset(themeColor.value)}
                title={t(themeColor.labelKey)}
                aria-label={t(themeColor.labelKey)}
                className={cn(
                  "flex items-center justify-center p-0.5 rounded-full outline-none transition-all cursor-pointer ring-offset-2 ring-offset-background",
                  active ? "ring-2 ring-primary scale-110" : "hover:scale-110"
                )}
              >
                <span
                  className="h-5 w-5 rounded-full border border-black/10 shadow-sm"
                  style={{ backgroundColor: themeColor.color }}
                />
              </button>
            );
          })}
        </div>
      </section>

      {/* UI Scale */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.uiScale")}
        </label>
        <div className="flex gap-1 mt-2">
          {(["xs", "sm", "md", "lg", "xl"] as UIScale[]).map((scale) => (
            <button
              key={scale}
              onClick={() => setUIScale(scale)}
              className={cn(
                "flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors",
                uiScale === scale
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {t(`settings.uiScale_${scale}`)}
            </button>
          ))}
        </div>
      </section>

      {/* Font Family */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.fontFamily")}
        </label>
        <select
          value={fontFamily}
          onChange={(e) => setFontFamily(e.target.value as FontFamily)}
          className="mt-2 w-full h-7 px-2 text-xs bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
        >
          {(
            ["system", "microsoft-yahei", "noto-sans", "mono"] as FontFamily[]
          ).map((f) => (
            <option key={f} value={f}>
              {t(`settings.fontFamily_${f}`)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs2 text-muted-foreground/70">
          {t("settings.fontFamilyDesc")}
        </p>
      </section>

      {/* Button position (Linux only) */}
      {platform === "linux" && (
        <section>
          <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
            {t("settings.buttonPosition")}
          </label>
          <div className="flex gap-1.5 mt-2">
            {(["left", "right"] as ButtonPosition[]).map((pos) => (
              <button
                key={pos}
                onClick={() => setButtonPosition(pos)}
                className={cn(
                  "flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors",
                  buttonPosition === pos
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {t(`settings.buttonPosition${pos.charAt(0).toUpperCase() + pos.slice(1)}`)}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs2 text-muted-foreground/70">
            {t("settings.buttonPositionDesc")}
          </p>
        </section>
      )}

      {/* Max history */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.historyLimit")}
        </label>
        <input
          type="number"
          min={10}
          max={10000}
          value={maxHistory}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v > 0) setMaxHistory(v);
          }}
          className="mt-2 w-24 h-7 px-2 text-xs bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
        />
        <p className="mt-1 text-xs2 text-muted-foreground/70">
          {t("settings.maxEntries")}
        </p>
      </section>

      {/* Auto expire */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.expireDays")}
        </label>
        <div className="flex gap-1.5 mt-2">
          {[
            { value: 0, labelKey: "settings.expireNever" },
            { value: 1, labelKey: "settings.expire1day" },
            { value: 7, labelKey: "settings.expire7days" },
            { value: 30, labelKey: "settings.expire30days" },
            { value: 90, labelKey: "settings.expire90days" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setExpireDays(opt.value)}
              className={cn(
                "flex-1 flex items-center justify-center py-1.5 rounded-md text-xs font-medium transition-colors",
                expireDays === opt.value
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs2 text-muted-foreground/70">
          {t("settings.expireDaysDesc")}
        </p>
      </section>

      {/* Paste and close */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("settings.autoClose")}
            </label>
            <p className="mt-0.5 text-xs2 text-muted-foreground/70">
              {t("settings.hidePanel")}
            </p>
          </div>
          <Toggle value={pasteAndClose} onChange={setPasteAndClose} />
        </div>
      </section>

      {/* Auto start */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("settings.autoStart")}
            </label>
            <p className="mt-0.5 text-xs2 text-muted-foreground/70">
              {t("settings.autoStartDesc")}
            </p>
          </div>
          <Toggle value={autoStart} onChange={setAutoStart} />
        </div>
      </section>

      {/* System notifications */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("settings.systemNotifications")}
            </label>
            <p className="mt-0.5 text-xs2 text-muted-foreground/70">
              {t("settings.systemNotificationsDesc")}
            </p>
          </div>
          <Toggle
            value={systemNotificationsEnabled}
            onChange={setSystemNotificationsEnabled}
          />
        </div>
      </section>

      {/* Default browser */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.defaultBrowser")}
        </label>
        <select
          value={defaultBrowser}
          onChange={(e) => setDefaultBrowser(e.target.value)}
          className="mt-2 w-full h-7 px-2 text-xs bg-muted/30 border border-border/50 rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
        >
          <option value="system">{t("settings.browserSystem")}</option>
          <option value="chrome">{t("settings.browserChrome")}</option>
          <option value="firefox">{t("settings.browserFirefox")}</option>
          <option value="edge">{t("settings.browserEdge")}</option>
          <option value="brave">{t("settings.browserBrave")}</option>
          {platform === "macos" && (
            <option value="safari">{t("settings.browserSafari")}</option>
          )}
        </select>
        <p className="mt-1 text-xs2 text-muted-foreground/70">
          {t("settings.defaultBrowserDesc")}
        </p>
      </section>

      {/* Toggle shortcut */}
      <section>
        <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
          {t("settings.toggleShortcut")}
        </label>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-7 px-2 text-xs bg-muted/30 border border-border/50 rounded-md text-foreground flex items-center">
            {isRecordingShortcut ? t("settings.shortcutRecording") : toggleShortcut}
          </div>
          <button
            onClick={() => setIsRecordingShortcut((prev) => !prev)}
            className={cn(
              "h-7 px-3 text-xs font-medium rounded-md transition-colors",
              isRecordingShortcut
                ? "bg-muted/50 text-muted-foreground hover:bg-muted/60"
                : "bg-primary/15 text-primary hover:bg-primary/25",
            )}
          >
            {isRecordingShortcut ? t("template.cancel") : t("settings.shortcutRecord")}
          </button>
        </div>
        <p className="mt-1 text-xs2 text-muted-foreground/70">
          {t("settings.toggleShortcutDesc")}
        </p>
      </section>

      {/* Preview close shortcut */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("preview.closeShortcut")}
            </label>
            <p className="mt-0.5 text-xs2 text-muted-foreground/70">
              {t("preview.closeShortcutDesc")}
            </p>
          </div>
          <button
            onClick={() => setIsRecordingCloseShortcut(true)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-mono transition-colors",
              isRecordingCloseShortcut
                ? "border-primary bg-primary/10 text-primary animate-pulse"
                : "border-border bg-card text-foreground hover:bg-accent"
            )}
          >
            {isRecordingCloseShortcut ? t("settings.recording") : previewCloseShortcut}
          </button>
        </div>
      </section>

      {/* Reset close confirmation */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("preview.resetConfirm")}
            </label>
            <p className="mt-0.5 text-xs2 text-muted-foreground/70">
              {t("preview.resetConfirmDesc")}
            </p>
          </div>
          <button
            onClick={() => {
              invoke("update_settings", { key: "preview_close_confirmed", value: "false" })
                .then(() => toast.success(t("preview.resetDone")))
                .catch(() => {});
            }}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent"
          >
            {t("preview.resetConfirm")}
          </button>
        </div>
      </section>

      {/* Auto check update */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("settings.autoCheckUpdate")}
            </label>
            <p className="mt-0.5 text-xs2 text-muted-foreground/70">
              {t("settings.autoCheckUpdateDesc")}
            </p>
          </div>
          <Toggle value={autoCheckUpdate} onChange={setAutoCheckUpdate} />
        </div>
      </section>

      {/* Auto download update */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm2 font-medium text-muted-foreground uppercase tracking-wider">
              {t("settings.autoDownloadUpdate")}
            </label>
            <p className="mt-0.5 text-xs2 text-muted-foreground/70">
              {t("settings.autoDownloadUpdateDesc")}
            </p>
          </div>
          <Toggle value={autoDownloadUpdate} onChange={setAutoDownloadUpdate} />
        </div>
      </section>

      {/* Check for updates button */}
      <section>
        <button
          disabled={isCheckingUpdate}
          onClick={async () => {
            setIsCheckingUpdate(true);
            try {
              const info = await checkForUpdates();
              if (info) {
                toast.success(t("update.available", { version: info.version }));
                await downloadAndInstall(info.update);
              } else {
                toast.info(t("update.latest"));
              }
            } catch {
              toast.error(t("update.failed"));
            } finally {
              setIsCheckingUpdate(false);
            }
          }}
          className={cn(
            "w-full h-7 px-3 text-xs font-medium rounded-md transition-colors",
            "bg-primary/15 text-primary hover:bg-primary/25",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isCheckingUpdate
            ? t("settings.checkingUpdate")
            : t("settings.checkUpdate")}
        </button>
      </section>
    </div>
  );
}
