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
} from "@/stores/settingsStore";
import {
  checkForUpdates,
  downloadAndInstall,
} from "@/services/updateService";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePlatform } from "@/contexts/PlatformContext";
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
  const toggleShortcut = useSettingsStore((s) => s.toggleShortcut);
  const autoCheckUpdate = useSettingsStore((s) => s.autoCheckUpdate);
  const autoDownloadUpdate = useSettingsStore((s) => s.autoDownloadUpdate);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setMaxHistory = useSettingsStore((s) => s.setMaxHistory);
  const setExpireDays = useSettingsStore((s) => s.setExpireDays);
  const setPasteAndClose = useSettingsStore((s) => s.setPasteAndClose);
  const setAutoStart = useSettingsStore((s) => s.setAutoStart);
  const setLocale = useSettingsStore((s) => s.setLocale);
  const setUIScale = useSettingsStore((s) => s.setUIScale);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const setToggleShortcut = useSettingsStore((s) => s.setToggleShortcut);
  const setAutoCheckUpdate = useSettingsStore((s) => s.setAutoCheckUpdate);
  const setAutoDownloadUpdate = useSettingsStore((s) => s.setAutoDownloadUpdate);
  const buttonPosition = useSettingsStore((s) => s.buttonPosition);
  const setButtonPosition = useSettingsStore((s) => s.setButtonPosition);
  const defaultBrowser = useSettingsStore((s) => s.defaultBrowser);
  const setDefaultBrowser = useSettingsStore((s) => s.setDefaultBrowser);
  const platform = usePlatform();
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);

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
