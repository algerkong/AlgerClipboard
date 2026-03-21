import { useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { TitleBar } from "@/components/TitleBar";
import { ClipboardPanel } from "@/pages/ClipboardPanel";
import { SettingsPage } from "@/pages/settings";
import { TemplateManager } from "@/pages/TemplateManager";
import { ImageViewerPage } from "@/components/ImageViewer";
import { DetailPage } from "@/pages/DetailPage";
import { TagManagerPage } from "@/pages/TagManager";
import { AskAiPanel } from "@/pages/AskAiPanel";
import { FileViewerPage } from "@/pages/FileViewerPage";
import { SpotlightPanel } from "@/pages/SpotlightPanel";
import { openSettingsWindow } from "@/services/settingsWindowService";
import { toast } from "@/lib/toast";
import { useClipboardStore } from "@/stores/clipboardStore";
import { useCapabilityStore } from "@/stores/capabilityStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { PlatformProvider } from "@/contexts/PlatformContext";
import { useSyncStore } from "@/stores/syncStore";
import { startPeriodicUpdateCheck, stopPeriodicUpdateCheck } from "@/services/updateService";
import { openUrl } from "@/services/settingsService";
import type { ClipboardEntry } from "@/types";


// Global safety net: intercept all <a> clicks and open in external browser
document.addEventListener("click", (e) => {
  const anchor = (e.target as HTMLElement).closest("a");
  if (anchor) {
    const href = anchor.getAttribute("href");
    if (href && /^https?:\/\//i.test(href)) {
      e.preventDefault();
      e.stopPropagation();
      openUrl(href).catch(() => {});
    }
  }
}, true);

// Detect window type from URL params
const searchParams = new URLSearchParams(window.location.search);
const isImageViewer = searchParams.get("window") === "image-viewer";
const isTemplateManager = searchParams.get("window") === "template-manager";
const isSettings = searchParams.get("window") === "settings";
const isDetail = searchParams.get("window") === "detail";
const isTagManager = searchParams.get("window") === "tag-manager";
const isAskAi = searchParams.get("window") === "ask-ai";
const isFileViewer = searchParams.get("window") === "file-viewer";
const isSpotlight = searchParams.get("window") === "spotlight";
const initialSettingsTab = searchParams.get("tab") || undefined;

function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // System preference
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    if (prefersDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

function App() {
  const loadAvailability = useCapabilityStore((s) => s.loadAvailability);

  // Show window after React mounts to prevent flash of unstyled/unsized content.
  // All windows are created with visible: false and shown here after content is ready.
  useEffect(() => {
    getCurrentWebviewWindow().show();
  }, []);

  useEffect(() => {
    void loadAvailability();

    const handleFocus = () => {
      void loadAvailability();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadAvailability();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadAvailability]);

  // If this is the Spotlight window, render it without PlatformProvider/TitleBar
  if (isSpotlight) {
    return <SpotlightPanel />;
  }

  // If this is an image viewer window, render the standalone viewer
  if (isImageViewer) {
    return <ImageViewerPage />;
  }

  // If this is a file viewer window, render standalone file viewer
  if (isFileViewer) {
    return (
      <PlatformProvider>
        <FileViewerWindow />
      </PlatformProvider>
    );
  }

  // If this is a template manager window, render standalone template manager
  if (isTemplateManager) {
    return (
      <PlatformProvider>
        <TemplateManagerWindow />
      </PlatformProvider>
    );
  }

  // If this is a detail window, render standalone detail page
  if (isDetail) {
    return (
      <PlatformProvider>
        <DetailWindow />
      </PlatformProvider>
    );
  }

  if (isTagManager) {
    return (
      <PlatformProvider>
        <TagManagerWindow />
      </PlatformProvider>
    );
  }

  // If this is an ask-ai window, render the AI panel
  if (isAskAi) {
    return (
      <PlatformProvider>
        <AskAiWindow />
      </PlatformProvider>
    );
  }

  // If this is a settings window, render standalone settings
  if (isSettings) {
    return (
      <PlatformProvider>
        <SettingsWindow />
      </PlatformProvider>
    );
  }

  return (
    <PlatformProvider>
      <MainApp />
    </PlatformProvider>
  );
}

function TemplateManagerWindow() {
  const { i18n } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Escape key closes the window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        getCurrentWebviewWindow().close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClose = useCallback(() => {
    getCurrentWebviewWindow().close();
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="flex-1 min-h-0">
        <TemplateManager onBack={handleClose} />
      </div>
    </div>
  );
}

function SettingsWindow() {
  const { i18n, t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    void getCurrentWebviewWindow().setTitle(t("settings.title"));
  }, [t, locale]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        getCurrentWebviewWindow().close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClose = useCallback(() => {
    getCurrentWebviewWindow().close();
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar onClose={handleClose} title={t("settings.title")} showSyncIndicator={false} showPinButton={false} />
      <div className="flex-1 min-h-0">
        <SettingsPage onBack={handleClose} initialTab={initialSettingsTab} />
      </div>
    </div>
  );
}

function DetailWindow() {
  const { i18n, t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    void getCurrentWebviewWindow().setTitle(t("detail.title"));
  }, [t, locale]);

  const handleClose = useCallback(async () => {
    await invoke("focus_main_window").catch(() => {});
    getCurrentWebviewWindow().close();
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar onClose={handleClose} title={t("detail.title")} showSyncIndicator={false} />
      <div className="flex-1 min-h-0">
        <DetailPage />
      </div>
    </div>
  );
}

function TagManagerWindow() {
  const { i18n, t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    void getCurrentWebviewWindow().setTitle(t("tags.title"));
  }, [t, locale]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        getCurrentWebviewWindow().close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClose = useCallback(() => {
    getCurrentWebviewWindow().close();
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar onClose={handleClose} title={t("tags.title")} showSyncIndicator={false} />
      <div className="flex-1 min-h-0">
        <TagManagerPage />
      </div>
    </div>
  );
}

function AskAiWindow() {
  const { i18n } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Escape key closes the window (use getCurrentWindow for bare Window)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        getCurrentWindow().close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return <AskAiPanel />;
}

function FileViewerWindow() {
  const { i18n, t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    void getCurrentWebviewWindow().setTitle(t("fileViewer.title"));
  }, [t, locale]);

  const handleClose = useCallback(async () => {
    await invoke("focus_main_window").catch(() => {});
    getCurrentWebviewWindow().close();
  }, []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar onClose={handleClose} title={t("fileViewer.title")} showSyncIndicator={false} />
      <div className="flex-1 min-h-0">
        <FileViewerPage />
      </div>
    </div>
  );
}

function MainApp() {
  const { i18n, t } = useTranslation();
  const shouldResetOnNextFocusRef = useRef(false);
  const fetchHistory = useClipboardStore((s) => s.fetchHistory);
  const addEntry = useClipboardStore((s) => s.addEntry);
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const loadAccounts = useSyncStore((s) => s.loadAccounts);
  const setSyncStatus = useSyncStore((s) => s.setSyncStatus);
  const triggerSync = useSyncStore((s) => s.triggerSync);
  const accounts = useSyncStore((s) => s.accounts);
  const syncRealtimePollSeconds = useSyncStore((s) => s.syncRealtimePollSeconds);

  // Load settings, history, and sync accounts on mount
  useEffect(() => {
    loadSettings();
    fetchHistory();
    loadAccounts();
  }, [loadSettings, fetchHistory, loadAccounts]);

  // Auto-check for updates on startup and periodically
  const autoCheckUpdate = useSettingsStore((s) => s.autoCheckUpdate);
  const autoDownloadUpdate = useSettingsStore((s) => s.autoDownloadUpdate);
  useEffect(() => {
    if (!autoCheckUpdate) {
      stopPeriodicUpdateCheck();
      return;
    }
    startPeriodicUpdateCheck({ autoDownloadUpdate });
    return () => stopPeriodicUpdateCheck();
  }, [autoCheckUpdate, autoDownloadUpdate]);

  // Sync i18n language with stored locale
  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(theme);

    // Listen for system theme changes when theme is "system"
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => {
        if (e.matches) {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      };
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);

  // Listen for entry-summary-updated event from Rust backend (AI auto-summary)
  useEffect(() => {
    const unlisten = listen<{ id: string; ai_summary: string }>("entry-summary-updated", (event) => {
      useClipboardStore.getState().updateEntrySummary(event.payload.id, event.payload.ai_summary);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Listen for clipboard-changed event from Rust backend
  // Use ref to avoid re-subscribing the listener when accounts change
  const realtimeSyncRef = useRef<() => void>(() => {});
  useEffect(() => {
    realtimeSyncRef.current = () => {
      const realtimeAccounts = useSyncStore.getState().accounts.filter(
        (a) => a.enabled && a.sync_frequency === "realtime"
      );
      const status = useSyncStore.getState().syncStatus;
      if (status !== "syncing") {
        for (const acc of realtimeAccounts) {
          useSyncStore.getState().triggerSync(acc.id);
        }
      }
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<{ entry: ClipboardEntry; from_paste: boolean }>(
      "clipboard-changed",
      (event) => {
        addEntry(event.payload.entry);
        // Suppress the "Copied" toast when the clipboard change was caused by
        // our own paste operation — the user will already see a "Pasted" toast.
        if (!event.payload.from_paste) {
          toast.success(t("toast.copied"));
        }
        // Trigger realtime sync after a short debounce
        setTimeout(() => realtimeSyncRef.current(), 500);
      }
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addEntry, t]);

  // Interval-based auto sync
  useEffect(() => {
    const intervalAccounts = accounts.filter(
      (a) => a.enabled && a.sync_frequency === "interval" && a.interval_minutes
    );
    if (intervalAccounts.length === 0) return;

    const timers = intervalAccounts.map((acc) => {
      const ms = (acc.interval_minutes ?? 15) * 60 * 1000;
      return setInterval(() => {
        if (useSyncStore.getState().syncStatus !== "syncing") {
          triggerSync(acc.id);
        }
      }, ms);
    });

    return () => timers.forEach(clearInterval);
  }, [accounts, triggerSync]);

  // Realtime polling: periodically pull remote changes for realtime sync accounts
  useEffect(() => {
    const realtimeAccounts = accounts.filter(
      (a) => a.enabled && a.sync_frequency === "realtime"
    );
    if (realtimeAccounts.length === 0) return;

    const ms = Math.max(syncRealtimePollSeconds, 5) * 1000;
    const timer = setInterval(() => {
      if (useSyncStore.getState().syncStatus !== "syncing") {
        for (const acc of realtimeAccounts) {
          triggerSync(acc.id);
        }
      }
    }, ms);

    return () => clearInterval(timer);
  }, [accounts, syncRealtimePollSeconds, triggerSync]);

  // Listen for sync-status-changed events from Rust backend
  useEffect(() => {
    const unlisten = listen<{ status: string; error?: string }>("sync-status-changed", (event) => {
      const { status, error } = event.payload;
      setSyncStatus(status as "idle" | "syncing" | "synced" | "error", error ?? null);
      if (status === "synced") {
        fetchHistory();
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [setSyncStatus, fetchHistory]);

  const hideMainWindow = useCallback(() => {
    shouldResetOnNextFocusRef.current = true;
    getCurrentWebviewWindow().hide();
  }, []);

  // Reset to home view only after the window was previously hidden
  useEffect(() => {
    const unlisten = listen("tauri://focus", () => {
      if (!shouldResetOnNextFocusRef.current) {
        return;
      }

      shouldResetOnNextFocusRef.current = false;
      useClipboardStore.getState().resetView();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Mark reset when main window is shown by backend paths (shortcut/tray/single-instance)
  useEffect(() => {
    const unlisten = listen("main-window-opened", () => {
      shouldResetOnNextFocusRef.current = true;

      if (document.hasFocus()) {
        shouldResetOnNextFocusRef.current = false;
        useClipboardStore.getState().resetView();
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Auto-hide when window loses focus (unless pinned).
  // Pin only controls this blur behavior — alwaysOnTop stays true always
  // because a skip-taskbar popup window on Windows needs it to receive focus.
  //
  // We debounce the hide and cancel it if focus returns quickly, because the
  // show_and_focus_main_window ALT-key trick can cause a transient blur event
  // before focus is fully established.
  const isPinned = useSettingsStore((s) => s.isPinned);
  const blurTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const cancelPendingHide = () => {
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
    };

    const unlistenBlur = listen("tauri://blur", () => {
      if (!isPinned) {
        cancelPendingHide();
        blurTimerRef.current = window.setTimeout(() => {
          blurTimerRef.current = null;
          // Final check: if focus already returned, don't hide
          if (!document.hasFocus()) {
            hideMainWindow();
          }
        }, 150);
      }
    });

    // If focus returns before the timer fires, cancel the pending hide
    const unlistenFocus = listen("tauri://focus", () => {
      cancelPendingHide();
    });

    return () => {
      cancelPendingHide();
      unlistenBlur.then((fn) => fn());
      unlistenFocus.then((fn) => fn());
    };
  }, [hideMainWindow, isPinned]);

  // Escape key hides the window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        hideMainWindow();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hideMainWindow]);

  const handleOpenSettings = useCallback(() => {
    openSettingsWindow();
  }, []);

  return (
    <div className="app-shell flex h-screen flex-col overflow-hidden">
      <TitleBar onClose={hideMainWindow} />
      <div className="flex-1 min-h-0">
        <ClipboardPanel onOpenSettings={handleOpenSettings} />
      </div>
    </div>
  );
}

export default App;
