import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { CaretDown, CaretRight, FolderOpen, ArrowsClockwise, Shield, Trash, PuzzlePiece, Plus, X } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { LucideIcon } from "@/components/spotlight/LucideIcon";
import { StyledSelect } from "@/components/ui/styled-select";
import {
  scanPlugins,
  enablePlugin,
  disablePlugin,
  removePlugin,
  grantPluginPermissions,
  getPluginPermissions,
  getPluginDir,
  setPluginSetting,
  resolveI18n,
  type PluginInfo,
  type PluginSettingDef,
} from "@/services/pluginService";
import { pluginRegistry } from "@/plugin_system/registry";
import { getSetting } from "@/services/settingsService";
import {
  SettingsSection,
  SettingsButton,
  SettingsRow,
  SettingsInput,
  SettingsSubsection,
  Toggle,
  buildShortcutFromKeyboardEvent,
} from "./shared";

export function PluginsTab() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlugin, setExpandedPlugin] = useState<string | null>(null);

  const loadPlugins = useCallback(async () => {
    try {
      setLoading(true);
      const list = await scanPlugins();
      setPlugins(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlugins();
  }, [loadPlugins]);

  const handleToggle = async (plugin: PluginInfo) => {
    try {
      if (plugin.enabled) {
        await disablePlugin(plugin.id);
      } else {
        // Auto-grant permissions on first enable
        if (plugin.permissions.length > 0) {
          const granted = await getPluginPermissions(plugin.id);
          if (granted.length === 0) {
            await grantPluginPermissions(plugin.id, plugin.permissions);
          }
        }
        await enablePlugin(plugin.id);
      }
      await loadPlugins();
    } catch {
      toast.error(
        plugin.enabled
          ? t("settings.plugins.disable")
          : t("settings.plugins.enable"),
      );
    }
  };

  const handleRemove = async (plugin: PluginInfo) => {
    if (!confirm(t("settings.plugins.confirmRemove"))) return;
    try {
      await removePlugin(plugin.id);
      await loadPlugins();
    } catch {
      toast.error(t("settings.plugins.remove"));
    }
  };

  const handleOpenPluginDir = async () => {
    try {
      const dir = await getPluginDir();
      await invoke("open_in_explorer", { path: dir });
    } catch {
      // ignore
    }
  };

  const toggleExpand = (pluginId: string) => {
    setExpandedPlugin((prev) => (prev === pluginId ? null : pluginId));
  };

  return (
    <>
      <SettingsSection
        title={t("settings.plugins.installed")}
        aside={
          <div className="flex items-center gap-2">
            <SettingsButton onClick={loadPlugins} title={t("settings.plugins.refresh")}>
              <ArrowsClockwise size={14} className="mr-1.5" />
              {t("settings.plugins.refresh")}
            </SettingsButton>
            <SettingsButton onClick={handleOpenPluginDir}>
              <FolderOpen size={14} className="mr-1.5" />
              {t("settings.plugins.openPluginDir")}
            </SettingsButton>
          </div>
        }
      >
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            ...
          </div>
        ) : plugins.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            {t("settings.plugins.noPlugins")}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="px-4 py-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {/* Expand button for settings */}
                      <button
                        onClick={() => toggleExpand(plugin.id)}
                        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted"
                      >
                        {expandedPlugin === plugin.id ? (
                          <CaretDown size={14} />
                        ) : (
                          <CaretRight size={14} />
                        )}
                      </button>
                      {/* Plugin icon */}
                      {plugin.icon && plugin.icon.startsWith("ph:") ? (
                        <LucideIcon name={plugin.icon} size={18} />
                      ) : (
                        <PuzzlePiece size={18} className="text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">
                        {resolveI18n(plugin.name, locale)}
                      </span>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        v{plugin.version}
                      </span>
                      {plugin.has_backend && (
                        <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400">
                          Native
                        </span>
                      )}
                    </div>
                    {plugin.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {resolveI18n(plugin.description, locale)}
                      </p>
                    )}
                  </div>

                  <div className="ml-4 flex items-center gap-2">
                    <Toggle
                      value={plugin.enabled}
                      onChange={() => handleToggle(plugin)}
                    />
                    <button
                      onClick={() => handleRemove(plugin)}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                      title={t("settings.plugins.remove")}
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>

                {/* Permissions */}
                {plugin.permissions.length > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Shield size={14} />
                    <span>{t("settings.plugins.permissions")}:</span>
                    <span>{plugin.permissions.join(", ")}</span>
                  </div>
                )}

                {/* Plugin Settings (expandable) */}
                {expandedPlugin === plugin.id && (
                  <>
                    {Object.keys(plugin.settings).length > 0 && (
                      <PluginSettingsPanel
                        pluginId={plugin.id}
                        settings={plugin.settings}
                      />
                    )}
                    <PluginCustomSections pluginId={plugin.id} />
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </>
  );
}

function PluginSettingsPanel({
  pluginId,
  settings,
}: {
  pluginId: string;
  settings: Record<string, PluginSettingDef>;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [values, setValues] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const loaded: Record<string, string> = {};
      for (const [key, def] of Object.entries(settings)) {
        try {
          const val = await getSetting(`plugin:${pluginId}:${key}`);
          loaded[key] = val ?? (def.default != null ? String(def.default) : "");
        } catch {
          loaded[key] = def.default != null ? String(def.default) : "";
        }
      }
      if (!cancelled) {
        setValues(loaded);
        setLoaded(true);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [pluginId, settings]);

  const handleChange = async (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    try {
      await setPluginSetting(pluginId, key, value);
    } catch (err) {
      console.error("Failed to save plugin setting:", err);
    }
  };

  if (!loaded) return null;

  return (
    <SettingsSubsection title={t("settings.plugins.settings")}>
      {Object.entries(settings).map(([key, def]) => {
        const description = def.description ? resolveI18n(def.description, locale) : undefined;

        if (def.type === "boolean") {
          return (
            <SettingsRow
              key={key}
              title={resolveI18n(def.label, locale) || key}
              description={description}
              control={
                <Toggle
                  value={values[key] === "true"}
                  onChange={(v) => handleChange(key, v ? "true" : "false")}
                />
              }
            />
          );
        }

        if (def.type === "select" && def.options) {
          return (
            <SettingsRow
              key={key}
              title={resolveI18n(def.label, locale) || key}
              description={description}
              control={
                <StyledSelect
                  value={values[key] ?? ""}
                  onChange={(v) => handleChange(key, v)}
                  options={def.options.map((o) => ({ value: o.value, label: resolveI18n(o.label, locale) }))}
                  className="w-48"
                />
              }
            />
          );
        }

        if (def.type === "shortcut") {
          return (
            <SettingsRow
              key={key}
              title={resolveI18n(def.label, locale) || key}
              description={description}
              control={
                <ShortcutRecorderInput
                  value={values[key] ?? ""}
                  onChange={(v) => handleChange(key, v)}
                  placeholder={t("settings.plugins.recordShortcut")}
                />
              }
            />
          );
        }

        if (def.type === "array") {
          return (
            <SettingsRow
              key={key}
              title={resolveI18n(def.label, locale) || key}
              description={description}
              stacked
              control={
                <ArrayEditor
                  value={values[key] ?? "[]"}
                  onChange={(v) => handleChange(key, v)}
                />
              }
            />
          );
        }

        // Default: string / number / secret
        return (
          <SettingsRow
            key={key}
            title={resolveI18n(def.label, locale) || key}
            description={description}
            control={
              <SettingsInput
                type={def.secret ? "password" : def.type === "number" ? "number" : "text"}
                value={values[key] ?? ""}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={def.default != null ? String(def.default) : ""}
                min={def.min}
                max={def.max}
                step={def.step}
                className="w-48"
              />
            }
          />
        );
      })}
    </SettingsSubsection>
  );
}

/* ── Shortcut Recorder ── */

function ShortcutRecorderInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    const shortcut = buildShortcutFromKeyboardEvent(e.nativeEvent);
    if (shortcut) {
      onChange(shortcut);
      setRecording(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <SettingsInput
        readOnly
        value={recording ? t("settings.plugins.recordShortcut") : value}
        onKeyDown={handleKeyDown}
        onBlur={() => setRecording(false)}
        onClick={() => setRecording(true)}
        placeholder={placeholder}
        className="w-40 cursor-pointer"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={t("settings.plugins.clearShortcut")}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ── Array Editor ── */

function ArrayEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { t } = useTranslation();
  let items: string[] = [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    // ignore
  }

  const update = (newItems: string[]) => {
    onChange(JSON.stringify(newItems));
  };

  const handleItemChange = (index: number, val: string) => {
    const next = [...items];
    next[index] = val;
    update(next);
  };

  const addItem = () => {
    update([...items, ""]);
  };

  const removeItem = (index: number) => {
    update(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-1.5 w-full">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <SettingsInput
            value={item}
            onChange={(e) => handleItemChange(index, e.target.value)}
            className="flex-1"
          />
          <button
            onClick={() => removeItem(index)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Plus size={12} />
        {t("settings.plugins.addItem")}
      </button>
    </div>
  );
}

/* ── Plugin Custom Settings Section (registerSettingsSection) ── */

function PluginCustomSections({ pluginId }: { pluginId: string }) {
  const sections = pluginRegistry.getAllSettingsSections().filter(
    (s) => pluginRegistry.settingsSections.has(pluginId) &&
      pluginRegistry.settingsSections.get(pluginId)!.includes(s)
  );

  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) => (
        <PluginCustomSection key={section.id} section={section} />
      ))}
    </>
  );
}

function PluginCustomSection({
  section,
}: {
  section: { id: string; label: string; icon?: string; render: (container: HTMLElement, helpers: ReturnType<typeof buildSettingsHelpers>) => void | (() => void) };
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.innerHTML = "";

    const helpers = buildSettingsHelpers();
    const cleanup = section.render(container, helpers);

    return () => {
      if (typeof cleanup === "function") cleanup();
      container.innerHTML = "";
    };
  }, [section]);

  return (
    <SettingsSubsection title={section.label}>
      <div ref={containerRef} className="space-y-2" />
    </SettingsSubsection>
  );
}

/* ── Settings Helpers for custom DOM sections ── */

function buildSettingsHelpers() {
  return {
    createToggle(opts: { label: string; value: boolean; onChange: (v: boolean) => void }): HTMLElement {
      const row = document.createElement("div");
      row.className = "settings-row";

      const labelDiv = document.createElement("div");
      labelDiv.className = "settings-row-title";
      labelDiv.textContent = opts.label;

      const btn = document.createElement("button");
      btn.className = `relative rounded-full transition-colors w-8 h-[18px] ${opts.value ? "bg-primary/80" : "bg-muted"}`;
      const dot = document.createElement("span");
      dot.className = `absolute top-[2px] left-[2px] rounded-full bg-white shadow transition-transform w-[14px] h-[14px] ${opts.value ? "translate-x-[14px]" : ""}`;
      btn.appendChild(dot);

      let currentValue = opts.value;
      btn.addEventListener("click", () => {
        currentValue = !currentValue;
        btn.className = `relative rounded-full transition-colors w-8 h-[18px] ${currentValue ? "bg-primary/80" : "bg-muted"}`;
        dot.className = `absolute top-[2px] left-[2px] rounded-full bg-white shadow transition-transform w-[14px] h-[14px] ${currentValue ? "translate-x-[14px]" : ""}`;
        opts.onChange(currentValue);
      });

      row.appendChild(labelDiv);
      row.appendChild(btn);
      return row;
    },

    createInput(opts: { label: string; value: string; type?: string; onChange: (v: string) => void }): HTMLElement {
      const row = document.createElement("div");
      row.className = "settings-row";

      const labelDiv = document.createElement("div");
      labelDiv.className = "settings-row-title";
      labelDiv.textContent = opts.label;

      const input = document.createElement("input");
      input.className = "settings-input w-48";
      input.type = opts.type ?? "text";
      input.value = opts.value;
      input.addEventListener("input", () => {
        opts.onChange(input.value);
      });

      row.appendChild(labelDiv);
      row.appendChild(input);
      return row;
    },

    createSelect(opts: { label: string; value: string; options: { label: string; value: string }[]; onChange: (v: string) => void }): HTMLElement {
      const row = document.createElement("div");
      row.className = "settings-row";

      const labelDiv = document.createElement("div");
      labelDiv.className = "settings-row-title";
      labelDiv.textContent = opts.label;

      const select = document.createElement("select");
      select.className = "settings-input w-48";
      for (const opt of opts.options) {
        const option = document.createElement("option");
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.value === opts.value) option.selected = true;
        select.appendChild(option);
      }
      select.addEventListener("change", () => {
        opts.onChange(select.value);
      });

      row.appendChild(labelDiv);
      row.appendChild(select);
      return row;
    },
  };
}
