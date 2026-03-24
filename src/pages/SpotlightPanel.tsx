import { useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { useSpotlightStore } from "@/stores/spotlightStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { SpotlightInput } from "@/components/spotlight/SpotlightInput";
import { SpotlightResultList } from "@/components/spotlight/SpotlightResultList";
import { SpotlightFooter } from "@/components/spotlight/SpotlightFooter";
import { clipboardMode } from "@/spotlight/clipboardMode";
import { appMode } from "@/spotlight/appMode";
import { translateMode } from "@/spotlight/translateMode";
import { loadAllPlugins, reloadAllPlugins } from "@/plugin_system/loader";
import { hideSpotlightWindow } from "@/services/spotlightWindowService";
import { getSetting } from "@/services/settingsService";

function applyTheme(theme: "light" | "dark" | "system") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

export function SpotlightPanel() {
  const { i18n } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const mode = useSpotlightStore((s) => s.mode);
  const query = useSpotlightStore((s) => s.query);
  const results = useSpotlightStore((s) => s.results);
  const activate = useSpotlightStore((s) => s.activate);
  const hide = useSpotlightStore((s) => s.hide);
  const setResults = useSpotlightStore((s) => s.setResults);
  const selectNext = useSpotlightStore((s) => s.selectNext);
  const selectPrev = useSpotlightStore((s) => s.selectPrev);
  const executeSelected = useSpotlightStore((s) => s.executeSelected);
  const switchMode = useSpotlightStore((s) => s.switchMode);
  const registerMode = useSpotlightStore((s) => s.registerMode);
  const modes = useSpotlightStore((s) => s.modes);

  // Make html/body fully transparent for this window
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.borderRadius = "0";
    document.body.style.overflow = "hidden";
  }, []);

  const loadPrefixes = useSpotlightStore((s) => s.loadPrefixes);

  // Register built-in modes + load prefixes
  useEffect(() => {
    registerMode(clipboardMode);
    registerMode(appMode);
    registerMode(translateMode);
    loadPrefixes();
    loadAllPlugins();

    const unlisten = listen("plugins-changed", () => {
      reloadAllPlugins();
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [registerMode, loadPrefixes]);

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

  // Listen for spotlight-activate events from Rust
  useEffect(() => {
    const unlisten = listen<{ mode: string }>("spotlight-activate", async (event) => {
      activate(event.payload.mode);

      // Auto-fill clipboard text when opening translate mode
      if (event.payload.mode === "translate") {
        try {
          const autoTranslate = (await getSetting("spotlight_auto_translate_clipboard")) !== "false";
          if (autoTranslate) {
            const clipText = await navigator.clipboard.readText();
            if (clipText && clipText.trim().length > 0 && clipText.trim().length < 2000) {
              useSpotlightStore.setState({ query: clipText.trim() });
            }
          }
        } catch {
          // Clipboard read may fail without permission
        }
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [activate]);

  const resolveQuery = useSpotlightStore((s) => s.resolveQuery);
  const executeQuery = useSpotlightStore((s) => s.executeQuery);

  // Query dispatch — delegates to store's executeQuery
  const lastActiveModeRef = useRef(mode);
  useEffect(() => {
    const { activeMode } = resolveQuery(query);

    // When mode changes via prefix, clear results immediately
    if (activeMode !== lastActiveModeRef.current) {
      lastActiveModeRef.current = activeMode;
      setResults([]);
    }

    executeQuery(query);
  }, [query, mode, modes, setResults, resolveQuery, executeQuery]);

  const dismissSpotlight = useCallback(async () => {
    const clearOnHide = (await getSetting("spotlight_clear_on_hide")) === "true";
    if (clearOnHide) {
      useSpotlightStore.setState({ query: "", results: [], selectedIndex: 0 });
    }
    hide();
    hideSpotlightWindow();
  }, [hide]);

  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          selectNext();
          break;
        case "ArrowUp":
          e.preventDefault();
          selectPrev();
          break;
        case "Enter":
          e.preventDefault();
          await executeSelected({
            ctrlKey: e.ctrlKey || e.metaKey,
            shiftKey: e.shiftKey,
            altKey: e.altKey,
          });
          await dismissSpotlight();
          break;
        case "Tab":
          e.preventDefault();
          switchMode(e.shiftKey ? -1 : 1);
          break;
        case "Escape":
          e.preventDefault();
          await dismissSpotlight();
          break;
      }
    },
    [selectNext, selectPrev, executeSelected, switchMode, dismissSpotlight]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Blur → hide
  const blurTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const cancelPendingHide = () => {
      if (blurTimerRef.current !== null) {
        window.clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
    };

    const unlistenBlur = listen("tauri://blur", () => {
      cancelPendingHide();
      blurTimerRef.current = window.setTimeout(async () => {
        blurTimerRef.current = null;
        if (!document.hasFocus()) {
          const clearOnHide = (await getSetting("spotlight_clear_on_hide")) === "true";
          if (clearOnHide) {
            useSpotlightStore.setState({ query: "", results: [], selectedIndex: 0 });
          }
          hide();
          hideSpotlightWindow();
        }
      }, 150);
    });

    const unlistenFocus = listen("tauri://focus", () => {
      cancelPendingHide();
    });

    return () => {
      cancelPendingHide();
      unlistenBlur.then((fn) => fn());
      unlistenFocus.then((fn) => fn());
    };
  }, [hide]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        dismissSpotlight();
      }
    },
    [dismissSpotlight]
  );

  return (
    <div
      className="spotlight-backdrop"
      onClick={handleBackdropClick}
    >
      <div className="spotlight-panel">
        <SpotlightInput />
        <SpotlightResultList />
        {results.length > 0 && <SpotlightFooter modeHints={modes.get(resolveQuery(query).activeMode)?.footerHints} />}
      </div>
    </div>
  );
}
