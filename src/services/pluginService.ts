import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getSetting, updateSetting } from "@/services/settingsService";

/** A string or a locale map like {"en": "...", "zh-CN": "..."} */
export type I18nString = string | Record<string, string>;

export function resolveI18n(val: I18nString | undefined | null, locale: string): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (val[locale]) return val[locale];
  const lang = locale.split("-")[0];
  if (val[lang]) return val[lang];
  if (val["en"]) return val["en"];
  const keys = Object.keys(val);
  return keys.length > 0 ? val[keys[0]] : "";
}

export interface PluginSettingOption {
  label: I18nString;
  value: string;
}

export interface PluginSettingDef {
  type: string;
  label: I18nString;
  secret?: boolean;
  default?: unknown;
  description?: I18nString;
  options?: PluginSettingOption[];
  min?: number;
  max?: number;
  step?: number;
  item_type?: string;
}

export interface SpotlightModeDecl {
  id: string;
  prefix: string;
  shortcut_setting_key: string;
}

export interface PluginInfo {
  id: string;
  name: I18nString;
  version: string;
  description: I18nString;
  author: string;
  icon: string;
  enabled: boolean;
  has_backend: boolean;
  has_frontend: boolean;
  permissions: string[];
  spotlight_modes: SpotlightModeDecl[];
  hooks: string[];
  settings: Record<string, PluginSettingDef>;
  frontend_entry_path: string;
  plugin_dir_path: string;
}

export async function listPlugins(): Promise<PluginInfo[]> {
  return invoke("list_plugins");
}

export async function scanPlugins(): Promise<PluginInfo[]> {
  return invoke("scan_plugins");
}

export async function enablePlugin(pluginId: string): Promise<void> {
  return invoke("enable_plugin", { pluginId });
}

export async function disablePlugin(pluginId: string): Promise<void> {
  return invoke("disable_plugin", { pluginId });
}

export async function removePlugin(pluginId: string): Promise<void> {
  return invoke("remove_plugin", { pluginId });
}

export async function invokePluginCommand(
  pluginId: string,
  command: string,
  args?: unknown
): Promise<unknown> {
  const argsStr = args != null ? JSON.stringify(args) : "{}";
  const result = await invoke<string>("invoke_plugin_command", {
    pluginId,
    command,
    args: argsStr,
  });
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

export async function getPluginSetting(
  pluginId: string,
  key: string
): Promise<unknown> {
  const raw = await getSetting(`plugin:${pluginId}:${key}`);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export async function setPluginSetting(
  pluginId: string,
  key: string,
  value: unknown
): Promise<void> {
  const oldRaw = await getSetting(`plugin:${pluginId}:${key}`);
  let oldValue: unknown = null;
  if (oldRaw !== null) {
    try { oldValue = JSON.parse(oldRaw); } catch { oldValue = oldRaw; }
  }
  await updateSetting(`plugin:${pluginId}:${key}`, JSON.stringify(value));
  await emit(`plugin:${pluginId}:setting-changed`, { key, value, oldValue });
}

export async function grantPluginPermissions(
  pluginId: string,
  perms: string[]
): Promise<void> {
  return invoke("grant_plugin_permissions", { pluginId, perms });
}

export async function getPluginPermissions(
  pluginId: string
): Promise<string[]> {
  return invoke("get_plugin_permissions", { pluginId });
}

export async function getPluginDir(): Promise<string> {
  return invoke("get_plugin_dir");
}
