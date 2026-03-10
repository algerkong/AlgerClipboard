import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useClipboardStore } from "@/stores/clipboardStore";
import { useTranslation } from "react-i18next";

export function SearchBar() {
  const { t } = useTranslation();
  const keyword = useClipboardStore((s) => s.keyword);
  const setKeyword = useClipboardStore((s) => s.setKeyword);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inputValue, setInputValue] = useState(keyword);

  useEffect(() => {
    setInputValue(keyword);
  }, [keyword]);

  useEffect(() => {
    const restoreFocus = () => {
      const applyFocus = () => {
        window.focus();
        void getCurrentWebview().setFocus().catch(() => {});
        inputRef.current?.focus();
      };

      applyFocus();
      const timers = [32, 96, 180].map((delay) => window.setTimeout(applyFocus, delay));
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    };

    let clearPendingFocus = restoreFocus();

    const unlistenFocus = listen("tauri://focus", () => {
      clearPendingFocus();
      clearPendingFocus = restoreFocus();
    });
    const unlistenMainWindowOpened = listen("main-window-opened", () => {
      clearPendingFocus();
      clearPendingFocus = restoreFocus();
    });

    return () => {
      clearPendingFocus();
      unlistenFocus.then((fn) => fn());
      unlistenMainWindowOpened.then((fn) => fn());
    };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setKeyword(value), 200);
    },
    [setKeyword]
  );

  const handleClear = useCallback(() => {
    setInputValue("");
    setKeyword("");
    inputRef.current?.focus();
  }, [setKeyword]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
  }, []);

  return (
    <div className="relative flex min-w-0 flex-1 items-center">
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
      <input
        ref={inputRef}
        aria-label={t("searchBar.placeholder")}
        placeholder={t("searchBar.placeholder")}
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        className="w-full h-8 rounded-lg border-[1.5px] border-border/60 bg-accent/30 py-1.5 pl-9 pr-9 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:bg-card focus:border-primary/30 focus:ring-3 focus:ring-ring/8"
      />
      {inputValue && (
        <button
          onClick={handleClear}
          aria-label={t("tags.cancel")}
          className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent/70 hover:text-foreground"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
