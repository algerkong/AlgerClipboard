import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { getSetting, updateSetting } from "@/services/settingsService";
import {
  addCustomApp,
  removeCustomApp,
  getCustomApps,
  scanApplications,
} from "@/services/appLauncherService";
import type { AppEntry } from "@/services/appLauncherService";
import {
  buildShortcutFromKeyboardEvent,
  MODIFIER_KEYS,
  SettingsButton,
  SettingsField,
  Toggle,
} from "./shared";
import { SettingsSection, SettingsRow } from "./shared";
import { StyledSelect } from "@/components/ui/styled-select";
import { X } from "lucide-react";

type RecordingTarget =
  | "clipboard"
  | "app"
  | "translate"
  | null;

export function SpotlightTab() {
  const { t } = useTranslation();

  const [enabled, setEnabled] = useState(true);
  const [clipboardShortcut, setClipboardShortcut] = useState("Alt+Shift+F");
  const [appShortcut, setAppShortcut] = useState("Alt+Shift+A");
  const [translateShortcut, setTranslateShortcut] = useState("Alt+Shift+T");
  const [clearOnHide, setClearOnHide] = useState(false);
  const [enterBehavior, setEnterBehavior] = useState("paste");
  const [maxResults, setMaxResults] = useState("8");
  const [recording, setRecording] = useState<RecordingTarget>(null);
  const [customApps, setCustomApps] = useState<AppEntry[]>([]);
  const [newAppName, setNewAppName] = useState("");
  const [newAppPath, setNewAppPath] = useState("");

  // Load settings
  useEffect(() => {
    const load = async () => {
      const [en, cs, as2, ts, coh, eb, mr] = await Promise.all([
        getSetting("spotlight_enabled"),
        getSetting("spotlight_clipboard_shortcut"),
        getSetting("spotlight_app_shortcut"),
        getSetting("spotlight_translate_shortcut"),
        getSetting("spotlight_clear_on_hide"),
        getSetting("spotlight_enter_behavior"),
        getSetting("spotlight_max_results"),
      ]);
      if (en !== null) setEnabled(en !== "false");
      if (cs) setClipboardShortcut(cs);
      if (as2) setAppShortcut(as2);
      if (ts) setTranslateShortcut(ts);
      if (coh !== null) setClearOnHide(coh === "true");
      if (eb) setEnterBehavior(eb);
      if (mr) setMaxResults(mr);

      const apps = await getCustomApps();
      setCustomApps(apps);
    };
    load();
  }, []);

  // Shortcut recording
  useEffect(() => {
    if (!recording) return;

    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setRecording(null);
        return;
      }

      if (MODIFIER_KEYS.has(event.key)) return;

      const shortcut = buildShortcutFromKeyboardEvent(event);
      if (!shortcut) {
        toast.error(t("settings.shortcutInvalid"));
        return;
      }

      const target = recording;
      setRecording(null);

      const setterMap: Record<string, (v: string) => void> = {
        clipboard: setClipboardShortcut,
        app: setAppShortcut,
        translate: setTranslateShortcut,
      };

      invoke("update_spotlight_shortcuts", {
        [target === "clipboard" ? "clipboardShortcut" : target === "app" ? "appShortcut" : "translateShortcut"]: shortcut,
      })
        .then(() => {
          setterMap[target](shortcut);
          toast.success(t("settings.shortcutSaved"));
        })
        .catch(() => toast.error(t("settings.shortcutInvalid")));
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [recording, t]);

  const handleToggleEnabled = async () => {
    const next = !enabled;
    setEnabled(next);
    await updateSetting("spotlight_enabled", String(next));
    // Re-register shortcuts
    invoke("update_spotlight_shortcuts", {}).catch(() => {});
  };

  const handleClearOnHideChange = async () => {
    const next = !clearOnHide;
    setClearOnHide(next);
    await updateSetting("spotlight_clear_on_hide", String(next));
  };

  const handleEnterBehaviorChange = async (value: string) => {
    setEnterBehavior(value);
    await updateSetting("spotlight_enter_behavior", value);
  };

  const handleMaxResultsChange = async (value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 20) return;
    setMaxResults(value);
    await updateSetting("spotlight_max_results", value);
  };

  const handleAddCustomApp = async () => {
    if (!newAppName.trim() || !newAppPath.trim()) return;
    await addCustomApp(newAppName.trim(), newAppPath.trim());
    setNewAppName("");
    setNewAppPath("");
    const apps = await getCustomApps();
    setCustomApps(apps);
    toast.success(t("spotlight.settings.add_app"));
  };

  const handleRemoveCustomApp = async (id: string) => {
    await removeCustomApp(id);
    const apps = await getCustomApps();
    setCustomApps(apps);
  };

  const handleRefreshApps = async () => {
    await scanApplications();
    toast.success(t("spotlight.settings.refresh_apps"));
  };

  const renderShortcutRow = (
    title: string,
    value: string,
    target: RecordingTarget,
  ) => (
    <SettingsRow
      title={title}
      control={
        <div className="flex w-full max-w-[22rem] items-center gap-3">
          <SettingsField className="flex-1">
            <div className="flex h-9 items-center font-mono text-sm">
              {recording === target
                ? t("settings.shortcutRecording")
                : value}
            </div>
          </SettingsField>
          <SettingsButton onClick={() => setRecording(recording === target ? null : target)}>
            {recording === target ? t("template.cancel") : t("settings.shortcutRecord")}
          </SettingsButton>
        </div>
      }
    />
  );

  return (
    <>
      {/* ─── General ─── */}
      <SettingsSection title={t("spotlight.settings.title")}>
        <SettingsRow
          title={t("spotlight.settings.enable")}
          control={
            <Toggle value={enabled} onChange={handleToggleEnabled} />
          }
        />

        <SettingsRow
          title={t("spotlight.settings.clear_on_hide")}
          control={
            <Toggle value={clearOnHide} onChange={handleClearOnHideChange} />
          }
        />

        <SettingsRow
          title={t("spotlight.settings.enter_behavior")}
          control={
            <StyledSelect
              value={enterBehavior}
              onChange={handleEnterBehaviorChange}
              options={[
                { value: "paste", label: t("spotlight.settings.paste") },
                { value: "copy", label: t("spotlight.settings.copy_only") },
              ]}
            />
          }
        />

        <SettingsRow
          title={t("spotlight.settings.max_results")}
          control={
            <input
              type="number"
              min={1}
              max={20}
              value={maxResults}
              onChange={(e) => handleMaxResultsChange(e.target.value)}
              className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm"
            />
          }
        />
      </SettingsSection>

      {/* ─── Shortcuts ─── */}
      <SettingsSection title={t("settings.toggleShortcut")}>
        {renderShortcutRow(
          t("spotlight.settings.shortcut_clipboard"),
          clipboardShortcut,
          "clipboard",
        )}
        {renderShortcutRow(
          t("spotlight.settings.shortcut_app"),
          appShortcut,
          "app",
        )}
        {renderShortcutRow(
          t("spotlight.settings.shortcut_translate"),
          translateShortcut,
          "translate",
        )}
      </SettingsSection>

      {/* ─── Custom Apps ─── */}
      <SettingsSection
        title={t("spotlight.settings.custom_apps")}
        aside={
          <SettingsButton onClick={handleRefreshApps}>
            {t("spotlight.settings.refresh_apps")}
          </SettingsButton>
        }
      >
        {/* Add new app */}
        <div className="flex items-center gap-2 p-3">
          <input
            type="text"
            placeholder={t("spotlight.settings.app_name")}
            value={newAppName}
            onChange={(e) => setNewAppName(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            placeholder={t("spotlight.settings.app_path")}
            value={newAppPath}
            onChange={(e) => setNewAppPath(e.target.value)}
            className="flex-[2] rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          />
          <SettingsButton onClick={handleAddCustomApp}>
            {t("spotlight.settings.add_app")}
          </SettingsButton>
        </div>

        {/* Custom app list */}
        {customApps.length > 0 && (
          <div className="divide-y divide-border">
            {customApps.map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{app.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {app.path}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveCustomApp(app.id)}
                  className="ml-2 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </>
  );
}
