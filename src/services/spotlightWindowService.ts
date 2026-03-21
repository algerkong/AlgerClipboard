import { invoke } from "@tauri-apps/api/core";

export async function hideSpotlightWindow() {
  await invoke("hide_spotlight_window");
}
