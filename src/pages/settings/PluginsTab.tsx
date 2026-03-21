import { useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { CaretDown, CaretRight, FolderOpen, ArrowsClockwise, Shield, Trash, PuzzlePiece } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { LucideIcon } from "@/components/spotlight/LucideIcon";
import {
  scanPlugins,
  enablePlugin,
  disablePlugin,
  removePlugin,
  grantPluginPermissions,
  getPluginPermissions,
  getPluginDir,
  setPluginSetting,
  type PluginInfo,
} from "@/services/pluginService";
import { getSetting } from "@/services/settingsService";
import {
  SettingsSection,
  SettingsButton,
  SettingsRow,
  SettingsInput,
  SettingsSubsection,
  Toggle,
} from "./shared";

export function PluginsTab() {
  const { t } = useTranslation();
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
        toast.success(t("settings.plugins.restartHint"));
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
                      {/* Expand button if plugin has settings */}
                      {Object.keys(plugin.settings).length > 0 && (
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
                      )}
                      {/* Plugin icon */}
                      {plugin.icon && plugin.icon.startsWith("ph:") ? (
                        <LucideIcon name={plugin.icon} size={18} />
                      ) : (
                        <PuzzlePiece size={18} className="text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">
                        {plugin.name}
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
                        {plugin.description}
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
                {expandedPlugin === plugin.id &&
                  Object.keys(plugin.settings).length > 0 && (
                    <PluginSettingsPanel
                      pluginId={plugin.id}
                      settings={plugin.settings}
                    />
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
  settings: Record<string, { type: string; label: string; secret?: boolean; default?: unknown }>;
}) {
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
    <SettingsSubsection title="Settings">
      {Object.entries(settings).map(([key, def]) => {
        if (def.type === "boolean") {
          return (
            <SettingsRow
              key={key}
              title={def.label || key}
              control={
                <Toggle
                  value={values[key] === "true"}
                  onChange={(v) => handleChange(key, v ? "true" : "false")}
                />
              }
            />
          );
        }

        return (
          <SettingsRow
            key={key}
            title={def.label || key}
            control={
              <SettingsInput
                type={def.secret ? "password" : def.type === "number" ? "number" : "text"}
                value={values[key] ?? ""}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={def.default != null ? String(def.default) : ""}
                className="w-48"
              />
            }
          />
        );
      })}
    </SettingsSubsection>
  );
}
