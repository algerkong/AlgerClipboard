/**
 * Reusable window size persistence via Rust backend (settings DB).
 * Each window type gets its own key.
 * Resize tracking is handled by Rust on_window_event, no frontend tracking needed.
 */

import { invoke } from "@tauri-apps/api/core";

export async function getSavedWindowSize(
  key: string,
  defaults: { width: number; height: number },
): Promise<{ width: number; height: number }> {
  try {
    const result = await invoke<{ width: number; height: number }>("get_window_size", {
      key,
      defaultWidth: defaults.width,
      defaultHeight: defaults.height,
    });
    if (result.width > 0 && result.height > 0) return result;
  } catch { /* ignore */ }
  return defaults;
}
