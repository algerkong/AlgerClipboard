import React, { useEffect, useCallback, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { TitleBar } from "@/components/TitleBar";
import { ClipboardPanel } from "@/pages/ClipboardPanel";
import { SettingsPage } from "@/pages/Settings";
import { TemplateManager } from "@/pages/TemplateManager";
import { ImageViewerPage } from "@/components/ImageViewer";
import { useClipboardStore } from "@/stores/clipboardStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { PlatformProvider } from "@/contexts/PlatformContext";
import { useSyncStore } from "@/stores/syncStore";
import { checkForUpdates, downloadAndInstall } from "@/services/updateService";
import type { ClipboardEntry } from "@/types";

// Detect window type from URL params
const searchParams = new URLSearchParams(window.location.search);
const isImageViewer = searchParams.get("window") === "image-viewer";
const isTemplateManager = searchParams.get("window") === "template-manager";

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
  // If this is an image viewer window, render the standalone viewer
  if (isImageViewer) {
    return <ImageViewerPage />;
  }

  // If this is a template manager window, render standalone template manager
  if (isTemplateManager) {
    return (
      <PlatformProvider>
        <TemplateManagerWindow />
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
    document.documentElement.classList.add("dark");
  }, []);

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
      <Toaster position="top-center" richColors duration={2000} toastOptions={{ style: { fontSize: "0.857rem", padding: "0.571rem 0.857rem" } }} />
    </div>
  );
}

function MainApp() {
  const { i18n } = useTranslation();
  const [showSettings, setShowSettings] = React.useState(false);
  const shouldResetOnNextFocusRef = useRef(false);
  const fetchHistory = useClipboardStore((s) => s.fetchHistory);
  const addEntry = useClipboardStore((s) => s.addEntry);
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  // Apply dark theme immediately on first render (before settings load)
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const loadAccounts = useSyncStore((s) => s.loadAccounts);
  const setSyncStatus = useSyncStore((s) => s.setSyncStatus);
  const triggerSync = useSyncStore((s) => s.triggerSync);
  const accounts = useSyncStore((s) => s.accounts);

  // Load settings, history, and sync accounts on mount
  useEffect(() => {
    loadSettings();
    fetchHistory();
    loadAccounts();
  }, [loadSettings, fetchHistory, loadAccounts]);

  // Auto-check for updates on startup
  const autoCheckUpdate = useSettingsStore((s) => s.autoCheckUpdate);
  const autoDownloadUpdate = useSettingsStore((s) => s.autoDownloadUpdate);
  useEffect(() => {
    if (!autoCheckUpdate) return;
    const timer = setTimeout(async () => {
      try {
        const info = await checkForUpdates();
        if (info) {
          if (autoDownloadUpdate) {
            await downloadAndInstall(info.update);
          }
        }
      } catch {
        // silently ignore update check failures on startup
      }
    }, 3000);
    return () => clearTimeout(timer);
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
    const unlisten = listen<ClipboardEntry>("clipboard-changed", (event) => {
      addEntry(event.payload);
      // Trigger realtime sync after a short debounce
      setTimeout(() => realtimeSyncRef.current(), 500);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addEntry]);

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
      setShowSettings(false);
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
        setShowSettings(false);
        useClipboardStore.getState().resetView();
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // Auto-hide when window loses focus (unless pinned)
  const isPinned = useSettingsStore((s) => s.isPinned);
  useEffect(() => {
    const unlisten = listen("tauri://blur", () => {
      if (!isPinned) {
        hideMainWindow();
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [hideMainWindow, isPinned]);

  // Escape key hides the window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showSettings) {
          setShowSettings(false);
        } else {
          hideMainWindow();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hideMainWindow, showSettings]);

  const handleOpenSettings = useCallback(() => setShowSettings(true), []);
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar onClose={hideMainWindow} />
      <div className="flex-1 min-h-0">
        {showSettings ? (
          <div className="h-full animate-slide-in">
            <SettingsPage onBack={handleCloseSettings} />
          </div>
        ) : (
          <ClipboardPanel onOpenSettings={handleOpenSettings} />
        )}
      </div>
      <Toaster position="top-center" richColors duration={2000} toastOptions={{ style: { fontSize: "0.857rem", padding: "0.571rem 0.857rem" } }} />
    </div>
  );
}

export default App;
