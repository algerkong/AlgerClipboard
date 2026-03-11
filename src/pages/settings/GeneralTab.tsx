import { useCallback, useEffect, useState, useMemo, useRef, type ReactNode } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { Moon, Monitor, Sun } from "lucide-react";
import { useClipboardStore } from "@/stores/clipboardStore";
import {
  useSettingsStore,
  type ButtonPosition,
  type FontFamily,
  type ThemeColorPreset,
  type UIScale,
} from "@/stores/settingsStore";
import { checkForUpdates, promptAndInstallUpdate } from "@/services/updateService";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { usePlatform } from "@/contexts/PlatformContext";
import { invoke } from "@tauri-apps/api/core";
import { StyledSelect } from "@/components/ui/styled-select";
import {
  buildShortcutFromKeyboardEvent,
  languages,
  MODIFIER_KEYS,
  SettingsButton,
  SettingsField,
  SettingsInput,
  SettingsRow,
  SettingsSection,
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
  const isIncognito = useClipboardStore((s) => s.isIncognito);
  const toggleIncognito = useClipboardStore((s) => s.toggleIncognito);
  const platform = usePlatform();

  const incognitoShortcut = useSettingsStore((s) => s.incognitoShortcut);
  const setIncognitoShortcut = useSettingsStore((s) => s.setIncognitoShortcut);
  const [isRecordingShortcut, setIsRecordingShortcut] = useState(false);
  const [isRecordingIncognitoShortcut, setIsRecordingIncognitoShortcut] = useState(false);
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
    if (!isRecordingIncognitoShortcut) return;

    const handleRecordShortcut = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setIsRecordingIncognitoShortcut(false);
        return;
      }

      if (MODIFIER_KEYS.has(event.key)) return;

      const nextShortcut = buildShortcutFromKeyboardEvent(event);
      if (!nextShortcut) {
        toast.error(t("settings.shortcutInvalid"));
        return;
      }

      setIsRecordingIncognitoShortcut(false);
      setIncognitoShortcut(nextShortcut)
        .then(() => toast.success(t("settings.shortcutSaved")))
        .catch(() => toast.error(t("settings.shortcutInvalid")));
    };

    window.addEventListener("keydown", handleRecordShortcut, true);
    return () => window.removeEventListener("keydown", handleRecordShortcut, true);
  }, [isRecordingIncognitoShortcut, setIncognitoShortcut, t]);

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

  // Lightweight CSS-only update during color picker drag (no reflow, no IPC)
  const handleColorLiveChange = useCallback((color: string) => {
    document.documentElement.style.setProperty("--theme-accent-source", color);
  }, []);

  // Full persist on release
  const handleColorCommit = useCallback((color: string) => {
    setThemeColorCustom(color);
    setThemeColorPreset("custom");
  }, [setThemeColorCustom, setThemeColorPreset]);

  const handleLocaleChange = (newLocale: string) => {
    setLocale(newLocale);
    i18n.changeLanguage(newLocale);
  };

  const languageOptions = useMemo(() => languages.map((l) => ({ value: l.value, label: l.label })), []);
  const themeOptions = useMemo(() => themes.map((th) => ({ value: th.value, label: t(th.labelKey) })), [t]);
  const themeColorOptions = useMemo(() => [
    ...themeColors.map((tc) => ({ value: tc.value, label: t(tc.labelKey) })),
    { value: "custom", label: t("settings.themeColor_custom") },
  ], [t]);
  const uiScaleOptions = useMemo(() => (["xs", "sm", "md", "lg", "xl"] as UIScale[]).map((s) => ({ value: s, label: t(`settings.uiScale_${s}`) })), [t]);
  const fontFamilyOptions = useMemo(() => (["system", "microsoft-yahei", "noto-sans", "mono"] as FontFamily[]).map((f) => ({ value: f, label: t(`settings.fontFamily_${f}`) })), [t]);
  const buttonPositionOptions = useMemo(() => [
    { value: "left", label: t("settings.buttonPositionLeft") },
    { value: "right", label: t("settings.buttonPositionRight") },
  ], [t]);
  const expireDaysOptions = useMemo(() => [
    { value: "0", label: t("settings.expireNever") },
    { value: "1", label: t("settings.expire1day") },
    { value: "7", label: t("settings.expire7days") },
    { value: "30", label: t("settings.expire30days") },
    { value: "90", label: t("settings.expire90days") },
  ], [t]);
  const browserOptions = useMemo(() => {
    const opts = [
      { value: "system", label: t("settings.browserSystem") },
      { value: "chrome", label: t("settings.browserChrome") },
      { value: "firefox", label: t("settings.browserFirefox") },
      { value: "edge", label: t("settings.browserEdge") },
      { value: "brave", label: t("settings.browserBrave") },
    ];
    if (platform === "macos") {
      opts.push({ value: "safari", label: t("settings.browserSafari") });
    }
    return opts;
  }, [t, platform]);

  return (
    <div className="space-y-5">
      {/* ─── Language ─── */}
      <SettingsSection title={t("settings.language")}>
        <SettingsRow
          title={t("settings.language")}
          description={t("settings.languageDesc")}
          control={
            <StyledSelect value={locale} onChange={handleLocaleChange} options={languageOptions} className="w-[15rem]" />
          }
        />
      </SettingsSection>

      {/* ─── Appearance ─── */}
      <SettingsSection title={t("settings.theme")}>
        <SettingsRow
          title={t("settings.theme")}
          control={
            <StyledSelect value={theme} onChange={(v) => setTheme(v as Theme)} options={themeOptions} className="w-[15rem]" />
          }
        />

        <SettingsRow
          title={t("settings.themeColor")}
          description={t("settings.themeColorDesc")}
          control={
            <div className="flex flex-wrap items-center justify-end gap-3">
              <StyledSelect
                value={themeColorPreset}
                onChange={(v) => setThemeColorPreset(v as ThemeColorPreset)}
                options={themeColorOptions}
                className="w-[15rem]"
              />
              <SettingsField className="w-[6.5rem]">
                <ColorPickerInput
                  value={themeColorCustom}
                  onLiveChange={handleColorLiveChange}
                  onCommit={handleColorCommit}
                  ariaLabel={t("settings.themeColorPicker")}
                />
              </SettingsField>
            </div>
          }
        />

        <SettingsRow
          title={t("settings.uiScale")}
          control={
            <StyledSelect value={uiScale} onChange={(v) => setUIScale(v as UIScale)} options={uiScaleOptions} className="w-[15rem]" />
          }
        />

        <SettingsRow
          title={t("settings.fontFamily")}
          description={t("settings.fontFamilyDesc")}
          control={
            <StyledSelect value={fontFamily} onChange={(v) => setFontFamily(v as FontFamily)} options={fontFamilyOptions} className="w-[15rem]" />
          }
        />

        {platform === "linux" ? (
          <SettingsRow
            title={t("settings.buttonPosition")}
            description={t("settings.buttonPositionDesc")}
            control={
              <StyledSelect value={buttonPosition} onChange={(v) => setButtonPosition(v as ButtonPosition)} options={buttonPositionOptions} className="w-[15rem]" />
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
            <StyledSelect value={String(expireDays)} onChange={(v) => setExpireDays(Number(v))} options={expireDaysOptions} className="w-[15rem]" />
          }
        />

        <SettingsRow
          title={t("settings.autoClose")}
          description={t("settings.hidePanel")}
          control={<Toggle value={pasteAndClose} onChange={setPasteAndClose} />}
        />

        <SettingsRow
          title={t("settings.incognitoMode")}
          description={t("settings.incognitoModeDesc")}
          control={
            <Toggle
              value={isIncognito}
              onChange={() => toggleIncognito()}
            />
          }
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
          title={t("settings.incognitoShortcut")}
          description={t("settings.incognitoShortcutDesc")}
          control={
            <div className="flex w-full max-w-[22rem] items-center gap-3">
              <SettingsField className="flex-1">
                <div className="flex h-9 items-center font-mono text-sm">
                  {isRecordingIncognitoShortcut
                    ? t("settings.shortcutRecording")
                    : incognitoShortcut || t("settings.shortcutNotSet")}
                </div>
              </SettingsField>
              <SettingsButton onClick={() => setIsRecordingIncognitoShortcut((prev) => !prev)}>
                {isRecordingIncognitoShortcut ? t("template.cancel") : t("settings.shortcutRecord")}
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
            <StyledSelect value={defaultBrowser} onChange={setDefaultBrowser} options={browserOptions} className="w-[15rem]" />
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
                  await promptAndInstallUpdate(info);
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

/**
 * Color picker that uses local state during drag to avoid expensive operations.
 *
 * On Windows, `<input type="color">` fires both `onInput` and `onChange` continuously
 * while dragging — NOT just on release. So we:
 * 1. Use uncontrolled input (defaultValue, not value) to avoid React re-renders
 * 2. Throttle CSS variable updates to once per animation frame
 * 3. Debounce the full persist (store + IPC) with a 300ms delay after last change,
 *    which naturally fires once when the user stops dragging or closes the picker
 */
function ColorPickerInput({
  value,
  onLiveChange,
  onCommit,
  ariaLabel,
}: {
  value: string;
  onLiveChange: (color: string) => void;
  onCommit: (color: string) => void;
  ariaLabel: string;
}) {
  const rafId = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingColor = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from external value changes (e.g. preset switch) without re-mounting
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafId.current);
      clearTimeout(debounceTimer.current);
    };
  }, []);

  const handleColorChange = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const color = (e.target as HTMLInputElement).value;
    pendingColor.current = color;

    // Throttle visual CSS update to one per frame
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(() => {
        rafId.current = 0;
        if (pendingColor.current !== null) {
          onLiveChange(pendingColor.current);
        }
      });
    }

    // Debounce the heavy persist — resets on every change, fires 300ms after last one
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (pendingColor.current !== null) {
        onCommit(pendingColor.current);
        pendingColor.current = null;
      }
    }, 300);
  }, [onLiveChange, onCommit]);

  return (
    <input
      ref={inputRef}
      type="color"
      defaultValue={value}
      onInput={handleColorChange}
      className="h-9 w-full cursor-pointer rounded-2xl border-0 bg-transparent p-1"
      aria-label={ariaLabel}
    />
  );
}
