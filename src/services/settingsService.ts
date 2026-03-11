import { invoke } from "@tauri-apps/api/core";

export async function getSetting(key: string): Promise<string | null> {
  return invoke("get_settings", { key });
}

export async function updateSetting(
  key: string,
  value: string
): Promise<void> {
  return invoke("update_settings", { key, value });
}

export async function setAutoStart(enabled: boolean): Promise<void> {
  return invoke("set_auto_start", { enabled });
}

export async function getAutoStart(): Promise<boolean> {
  return invoke("get_auto_start");
}

export async function updateToggleShortcut(shortcut: string): Promise<void> {
  return invoke("update_toggle_shortcut", { shortcut });
}

export async function updateIncognitoShortcut(shortcut: string): Promise<void> {
  return invoke("update_incognito_shortcut", { shortcut });
}

export async function openUrl(url: string): Promise<void> {
  return invoke("open_url", { url });
}
