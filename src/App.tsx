import { useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { TitleBar } from "@/components/TitleBar";
import { ClipboardPanel } from "@/pages/ClipboardPanel";
import { SettingsPage } from "@/pages/Settings";
import { TemplateManager } from "@/pages/TemplateManager";
import { useClipboardStore } from "@/stores/clipboardStore";
import { useSettingsStore } from "@/stores/settingsStore";
import type { ClipboardEntry } from "@/types";

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
  const { i18n } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const fetchHistory = useClipboardStore((s) => s.fetchHistory);
  const addEntry = useClipboardStore((s) => s.addEntry);
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  // Apply dark theme immediately on first render (before settings load)
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Load settings and initial history on mount
  useEffect(() => {
    loadSettings();
    fetchHistory();
  }, [loadSettings, fetchHistory]);

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
  useEffect(() => {
    const unlisten = listen<ClipboardEntry>("clipboard-changed", (event) => {
      addEntry(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [addEntry]);

  // Escape key hides the window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showSettings) {
          setShowSettings(false);
        } else if (showTemplates) {
          setShowTemplates(false);
        } else {
          getCurrentWebviewWindow().hide();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSettings, showTemplates]);

  const handleOpenSettings = useCallback(() => setShowSettings(true), []);
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);
  const handleOpenTemplates = useCallback(() => setShowTemplates(true), []);
  const handleCloseTemplates = useCallback(() => setShowTemplates(false), []);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TitleBar />
      <div className="flex-1 min-h-0">
        {showSettings ? (
          <SettingsPage onBack={handleCloseSettings} />
        ) : showTemplates ? (
          <TemplateManager onBack={handleCloseTemplates} />
        ) : (
          <ClipboardPanel onOpenSettings={handleOpenSettings} onOpenTemplates={handleOpenTemplates} />
        )}
      </div>
      <Toaster position="bottom-center" richColors />
    </div>
  );
}

export default App;
