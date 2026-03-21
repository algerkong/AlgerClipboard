import { invoke } from "@tauri-apps/api/core";
import { getSetting, updateSetting } from "@/services/settingsService";

export interface PluginSettingDef {
  type: string;
  label: string;
  secret?: boolean;
  default?: unknown;
}

export interface SpotlightModeDecl {
  id: string;
  prefix: string;
  shortcut_setting_key: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
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
  await updateSetting(`plugin:${pluginId}:${key}`, JSON.stringify(value));
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
