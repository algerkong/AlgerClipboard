import { invoke } from "@tauri-apps/api/core";
import type { SmartPasteConfig } from "@/types";

export async function getSmartPasteConfig(): Promise<SmartPasteConfig> {
  return invoke("get_smart_paste_config");
}

export async function saveSmartPasteConfig(
  config: SmartPasteConfig
): Promise<void> {
  return invoke("save_smart_paste_config", { config });
}

export async function resetSmartPasteConfig(): Promise<SmartPasteConfig> {
  return invoke("reset_smart_paste_config");
}
