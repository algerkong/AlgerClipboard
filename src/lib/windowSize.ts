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

/**
 * Hook-style: call in a useEffect to save window size on resize (debounced).
 * Returns cleanup function. Also writes to localStorage as a fast cache for
 * windows that need synchronous size reads before the Rust backend is available.
 */
export function trackWindowSize(key: string): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const handleResize = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify({
        width: window.outerWidth,
        height: window.outerHeight,
      }));
    }, 500);
  };
  window.addEventListener("resize", handleResize);
  return () => {
    clearTimeout(timer);
    window.removeEventListener("resize", handleResize);
  };
}
