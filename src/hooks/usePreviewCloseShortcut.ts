import { useEffect, useState, useCallback } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { invoke } from "@tauri-apps/api/core";

export function usePreviewCloseShortcut() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [closeKey, setCloseKey] = useState("Escape");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const key = await invoke<string | null>("get_settings", { key: "preview_close_shortcut" });
        if (key && key !== " " && !(key.length === 1 && /[a-zA-Z0-9]/.test(key))) {
          setCloseKey(key);
        } else if (key) {
          // Invalid saved key, reset to Escape
          await invoke("update_settings", { key: "preview_close_shortcut", value: "Escape" }).catch(() => {});
        }
        const conf = await invoke<string | null>("get_settings", { key: "preview_close_confirmed" });
        if (conf === "true") setConfirmed(true);
      } catch { /* ignore */ }
    })();
  }, []);

  const handleClose = useCallback(async () => {
    await invoke("focus_main_window").catch(() => {});
    getCurrentWebviewWindow().close();
  }, []);

  const handleConfirmYes = useCallback(async () => {
    setShowConfirm(false);
    setConfirmed(true);
    try {
      await invoke("update_settings", { key: "preview_close_confirmed", value: "true" });
    } catch { /* ignore */ }
    handleClose();
  }, [handleClose]);

  const handleConfirmNo = useCallback(() => {
    setShowConfirm(false);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== closeKey) return;

      // Don't close when user is editing text
      const el = e.target as HTMLElement;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;

      e.preventDefault();

      if (confirmed) {
        handleClose();
      } else {
        setShowConfirm(true);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeKey, confirmed, handleClose]);

  return { showConfirm, handleConfirmYes, handleConfirmNo, closeKey };
}
