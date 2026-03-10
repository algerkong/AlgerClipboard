import { useEffect, useState, type ReactNode } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Moon, Monitor, Sun } from "lucide-react";
import {
  useSettingsStore,
  type ButtonPosition,
  type FontFamily,
  type ThemeColorPreset,
  type UIScale,
} from "@/stores/settingsStore";
import { checkForUpdates, downloadAndInstall } from "@/services/updateService";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { usePlatform } from "@/contexts/PlatformContext";
import { invoke } from "@tauri-apps/api/core";
import {
  buildShortcutFromKeyboardEvent,
  languages,
  MODIFIER_KEYS,
  SettingsButton,
  SettingsField,
  SettingsInput,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
  Toggle,
  type Theme,
} from "./shared";

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
  const buttonPosition = useSettingsStore((s) => s.buttonPosition);
  const defaultBrowser = useSettingsStore((s) => s.defaultBrowser);
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
  const setButtonPosition = useSettingsStore((s) => s.setButtonPosition);
  const setDefaultBrowser = useSettingsStore((s) => s.setDefaultBrowser);
  const platform = usePlatform();

  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [previewCloseShortcut, setPreviewCloseShortcutState] = useState("Escape");
  const [isRecordingCloseShortcut, setIsRecordingCloseShortcut] = useState(false);
  const [appVersion, setAppVersion] = useState("...");

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
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion("unknown"));
  }, []);

  useEffect(() => {
    invoke<string | null>("get_settings", { key: "preview_close_shortcut" })
      .then((val) => {
        if (val && val !== " " && !(val.length === 1 && /[a-zA-Z0-9]/.test(val))) {
          setPreviewCloseShortcutState(val);
        } else if (val) {
          invoke("update_settings", { key: "preview_close_shortcut", value: "Escape" }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isRecordingCloseShortcut) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape" && previewCloseShortcut !== "Escape") {
        setIsRecordingCloseShortcut(false);
        return;
      }

      if (event.key === " " || (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key))) {
        toast.error(t("settings.shortcutInvalid"));
        setIsRecordingCloseShortcut(false);
        return;
      }

      setIsRecordingCloseShortcut(false);
      setPreviewCloseShortcutState(event.key);
      invoke("update_settings", { key: "preview_close_shortcut", value: event.key })
        .then(() => toast.success(t("settings.shortcutSaved")))
        .catch(() => toast.error(t("settings.shortcutInvalid")));
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isRecordingCloseShortcut, previewCloseShortcut, t]);

  const themes: { value: Theme; labelKey: string; icon: ReactNode }[] = [
    { value: "light", labelKey: "settings.light", icon: <Sun className="h-3.5 w-3.5" /> },
    { value: "dark", labelKey: "settings.dark", icon: <Moon className="h-3.5 w-3.5" /> },
    { value: "system", labelKey: "settings.auto", icon: <Monitor className="h-3.5 w-3.5" /> },
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
      {/* ─── Language ─── */}
      <SettingsSection title={t("settings.language")}>
        <SettingsRow
          title={t("settings.language")}
          description={t("settings.languageDesc")}
          control={
            <SettingsField className="w-[15rem]">
              <SettingsSelect value={locale} onChange={(event) => handleLocaleChange(event.target.value)}>
                {languages.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
          }
        />
      </SettingsSection>

      {/* ─── Appearance ─── */}
      <SettingsSection title={t("settings.theme")}>
        <SettingsRow
          title={t("settings.theme")}
          control={
            <SettingsField className="w-[15rem]">
              <SettingsSelect value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
                {themes.map((themeItem) => (
                  <option key={themeItem.value} value={themeItem.value}>
                    {t(themeItem.labelKey)}
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
          }
        />

        <SettingsRow
          title={t("settings.themeColor")}
          description={t("settings.themeColorDesc")}
          control={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <SettingsField className="w-[15rem]">
                <SettingsSelect
                  value={themeColorPreset}
                  onChange={(event) => setThemeColorPreset(event.target.value as ThemeColorPreset)}
                >
                  {themeColors.map((themeColor) => (
                    <option key={themeColor.value} value={themeColor.value}>
                      {t(themeColor.labelKey)}
                    </option>
                  ))}
                  <option value="custom">{t("settings.themeColor_custom")}</option>
                </SettingsSelect>
              </SettingsField>
              <SettingsField className="w-[6.5rem]">
                <input
                  type="color"
                  value={themeColorCustom}
                  onChange={(event) => {
                    setThemeColorCustom(event.target.value);
                    setThemeColorPreset("custom");
                  }}
                  className="h-9 w-full cursor-pointer rounded-2xl border-0 bg-transparent p-1"
                  aria-label={t("settings.themeColorPicker")}
                />
              </SettingsField>
            </div>
          }
        />

        <SettingsRow
          title={t("settings.uiScale")}
          control={
            <SettingsField className="w-[15rem]">
              <SettingsSelect value={uiScale} onChange={(event) => setUIScale(event.target.value as UIScale)}>
                {(["xs", "sm", "md", "lg", "xl"] as UIScale[]).map((scale) => (
                  <option key={scale} value={scale}>
                    {t(`settings.uiScale_${scale}`)}
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
          }
        />

        <SettingsRow
          title={t("settings.fontFamily")}
          description={t("settings.fontFamilyDesc")}
          control={
            <SettingsField className="w-[15rem]">
              <SettingsSelect
                value={fontFamily}
                onChange={(event) => setFontFamily(event.target.value as FontFamily)}
              >
                {(["system", "microsoft-yahei", "noto-sans", "mono"] as FontFamily[]).map((family) => (
                  <option key={family} value={family}>
                    {t(`settings.fontFamily_${family}`)}
                  </option>
                ))}
              </SettingsSelect>
            </SettingsField>
          }
        />

        {platform === "linux" ? (
          <SettingsRow
            title={t("settings.buttonPosition")}
            description={t("settings.buttonPositionDesc")}
            control={
              <SettingsField className="w-[15rem]">
                <SettingsSelect
                  value={buttonPosition}
                  onChange={(event) => setButtonPosition(event.target.value as ButtonPosition)}
                >
                  <option value="left">{t("settings.buttonPositionLeft")}</option>
                  <option value="right">{t("settings.buttonPositionRight")}</option>
                </SettingsSelect>
              </SettingsField>
            }
          />
        ) : null}
      </SettingsSection>

      {/* ─── History ─── */}
      <SettingsSection title={t("settings.historyLimit")}>
        <SettingsRow
          title={t("settings.historyLimit")}
          description={t("settings.maxEntries")}
          control={
            <SettingsField className="w-[8rem]">
              <SettingsInput
                type="number"
                min={10}
                max={10000}
                value={maxHistory}
                onChange={(event) => {
                  const value = parseInt(event.target.value, 10);
                  if (!Number.isNaN(value) && value > 0) {
                    setMaxHistory(value);
                  }
                }}
              />
            </SettingsField>
          }
        />

        <SettingsRow
          title={t("settings.expireDays")}
          description={t("settings.expireDaysDesc")}
          control={
            <SettingsField className="w-[15rem]">
              <SettingsSelect
                value={String(expireDays)}
                onChange={(event) => setExpireDays(Number(event.target.value))}
              >
                <option value="0">{t("settings.expireNever")}</option>
                <option value="1">{t("settings.expire1day")}</option>
                <option value="7">{t("settings.expire7days")}</option>
                <option value="30">{t("settings.expire30days")}</option>
                <option value="90">{t("settings.expire90days")}</option>
              </SettingsSelect>
            </SettingsField>
          }
        />

        <SettingsRow
          title={t("settings.autoClose")}
          description={t("settings.hidePanel")}
          control={<Toggle value={pasteAndClose} onChange={setPasteAndClose} />}
        />
      </SettingsSection>

      {/* ─── Shortcuts ─── */}
      <SettingsSection title={t("settings.toggleShortcut")}>
        <SettingsRow
          title={t("settings.toggleShortcut")}
          description={t("settings.toggleShortcutDesc")}
          control={
            <div className="flex w-full max-w-[22rem] items-center gap-3">
              <SettingsField className="flex-1">
                <div className="flex h-9 items-center font-mono text-sm">
                  {isRecordingShortcut ? t("settings.shortcutRecording") : toggleShortcut}
                </div>
              </SettingsField>
              <SettingsButton onClick={() => setIsRecordingShortcut((prev) => !prev)}>
                {isRecordingShortcut ? t("template.cancel") : t("settings.shortcutRecord")}
              </SettingsButton>
            </div>
          }
        />

        <SettingsRow
          title={t("preview.closeShortcut")}
          description={t("preview.closeShortcutDesc")}
          control={
            <SettingsButton
              tone={isRecordingCloseShortcut ? "primary" : "default"}
              className={cn("min-w-[9rem] font-mono", isRecordingCloseShortcut && "animate-pulse")}
              onClick={() => setIsRecordingCloseShortcut(true)}
            >
              {isRecordingCloseShortcut ? t("settings.recording") : previewCloseShortcut}
            </SettingsButton>
          }
        />

        <SettingsRow
          title={t("preview.resetConfirm")}
          description={t("preview.resetConfirmDesc")}
          control={
            <SettingsButton
              tone="ghost"
              onClick={() => {
                invoke("update_settings", { key: "preview_close_confirmed", value: "false" })
                  .then(() => toast.success(t("preview.resetDone")))
                  .catch(() => {});
              }}
            >
              {t("preview.resetConfirm")}
            </SettingsButton>
          }
        />
      </SettingsSection>

      {/* ─── System ─── */}
      <SettingsSection title={t("settings.autoStart")}>
        <SettingsRow
          title={t("settings.autoStart")}
          description={t("settings.autoStartDesc")}
          control={<Toggle value={autoStart} onChange={setAutoStart} />}
        />

        <SettingsRow
          title={t("settings.systemNotifications")}
          description={t("settings.systemNotificationsDesc")}
          control={<Toggle value={systemNotificationsEnabled} onChange={setSystemNotificationsEnabled} />}
        />

        <SettingsRow
          title={t("settings.defaultBrowser")}
          description={t("settings.defaultBrowserDesc")}
          control={
            <SettingsField className="w-[15rem]">
              <SettingsSelect
                value={defaultBrowser}
                onChange={(event) => setDefaultBrowser(event.target.value)}
              >
                <option value="system">{t("settings.browserSystem")}</option>
                <option value="chrome">{t("settings.browserChrome")}</option>
                <option value="firefox">{t("settings.browserFirefox")}</option>
                <option value="edge">{t("settings.browserEdge")}</option>
                <option value="brave">{t("settings.browserBrave")}</option>
                {platform === "macos" ? (
                  <option value="safari">{t("settings.browserSafari")}</option>
                ) : null}
              </SettingsSelect>
            </SettingsField>
          }
        />
      </SettingsSection>

      {/* ─── Version & Update ─── */}
      <SettingsSection
        title={t("settings.appVersion")}
        aside={<span className="settings-badge">{platform}</span>}
      >
        <SettingsRow
          title={t("settings.appVersion")}
          description={t("settings.appVersionDesc")}
          control={
            <SettingsField className="w-[12rem]">
              <div className="flex h-9 items-center text-sm font-semibold">
                v{appVersion}
              </div>
            </SettingsField>
          }
        />

        <SettingsRow
          title={t("settings.autoCheckUpdate")}
          description={t("settings.autoCheckUpdateDesc")}
          control={<Toggle value={autoCheckUpdate} onChange={setAutoCheckUpdate} />}
        />

        <SettingsRow
          title={t("settings.autoDownloadUpdate")}
          description={t("settings.autoDownloadUpdateDesc")}
          control={<Toggle value={autoDownloadUpdate} onChange={setAutoDownloadUpdate} />}
        />

        <div className="px-5 py-3">
          <SettingsButton
            tone="primary"
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
          >
            {isCheckingUpdate ? t("settings.checkingUpdate") : t("settings.checkUpdate")}
          </SettingsButton>
        </div>
      </SettingsSection>
    </div>
  );
}
