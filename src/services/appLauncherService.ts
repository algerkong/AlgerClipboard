import { invoke } from "@tauri-apps/api/core";

export interface AppEntry {
  id: string;
  name: string;
  path: string;
  icon_base64: string | null;
  source: "System" | "Custom";
  launch_count: number;
}

export async function scanApplications(): Promise<AppEntry[]> {
  return invoke("scan_applications");
}

export async function searchApplications(keyword: string): Promise<AppEntry[]> {
  return invoke("search_applications", { keyword });
}

export async function launchApplication(appPath: string, appId?: string): Promise<void> {
  return invoke("launch_application", { appPath, appId: appId ?? null });
}

export async function addCustomApp(name: string, path: string, iconPath?: string): Promise<void> {
  return invoke("add_custom_app", { name, path, iconPath: iconPath ?? null });
}

export async function removeCustomApp(id: string): Promise<void> {
  return invoke("remove_custom_app", { id });
}

export async function getCustomApps(): Promise<AppEntry[]> {
  return invoke("get_custom_apps");
}
