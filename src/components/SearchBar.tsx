import { useCallback, useEffect, useRef } from "react";
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

  useEffect(() => {
    inputRef.current?.focus();
    const unlistenFocus = listen("tauri://focus", () => {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    });
    return () => { unlistenFocus.then((fn) => fn()); };
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => setKeyword(value), 200);
    },
    [setKeyword]
  );

  const handleClear = useCallback(() => {
    if (inputRef.current) inputRef.current.value = "";
    setKeyword("");
    inputRef.current?.focus();
  }, [setKeyword]);

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
        defaultValue={keyword}
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
