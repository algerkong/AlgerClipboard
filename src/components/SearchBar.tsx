import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
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
    inputRef.current?.focus();
    const unlistenFocus = listen("tauri://focus", () => {
      setTimeout(() => inputRef.current?.focus(), 50);
    });
    return () => { unlistenFocus.then((fn) => fn()); };
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
    <div className="relative flex items-center flex-1">
      <Search className="absolute left-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          placeholder={t("searchBar.placeholder")}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="w-full h-7 pl-7 pr-7 text-xs bg-muted/50 border border-border/50 rounded-md text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring/30 focus:bg-muted"
        />
      {keyword && (
        <button
          onClick={handleClear}
          className="absolute right-1.5 p-0.5 rounded text-muted-foreground hover:text-foreground"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
