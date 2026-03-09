/**
 * Reusable window size persistence via localStorage.
 * Each window type gets its own key.
 */

export function getSavedWindowSize(
  key: string,
  defaults: { width: number; height: number },
): { width: number; height: number } {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.width > 0 && parsed.height > 0) return parsed;
    }
  } catch { /* ignore */ }
  return defaults;
}

/**
 * Hook-style: call in a useEffect to save window size on resize (debounced).
 * Returns cleanup function.
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
