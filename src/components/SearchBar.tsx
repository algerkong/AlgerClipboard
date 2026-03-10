import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Calendar } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useClipboardStore } from "@/stores/clipboardStore";
import { getSearchHistory, deleteSearchHistory, clearSearchHistory, addSearchHistory } from "@/services/clipboardService";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { SearchHistoryItem, TimeRange } from "@/types";

export function SearchBar() {
  const { t } = useTranslation();
  const keyword = useClipboardStore((s) => s.keyword);
  const setKeyword = useClipboardStore((s) => s.setKeyword);
  const timeRange = useClipboardStore((s) => s.timeRange);
  const setTimeRange = useClipboardStore((s) => s.setTimeRange);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inputValue, setInputValue] = useState(keyword);

  // Hover state with delayed leave
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search history
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

  // Time range dropdown
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const timeDropdownRef = useRef<HTMLDivElement>(null);

  // Regex detection
  const isRegexMode = inputValue.startsWith("/") && inputValue.endsWith("/") && inputValue.length > 2;

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      setShowTimeDropdown(false);
    }, 200);
  };

  // Cleanup hover timeout
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Fetch search history when hovered and input empty
  useEffect(() => {
    if (isHovered && !inputValue.trim()) {
      getSearchHistory(8).then(setSearchHistory).catch(() => {});
    }
  }, [isHovered, inputValue]);

  // Close time dropdown on outside click
  useEffect(() => {
    if (!showTimeDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(e.target as Node)) {
        setShowTimeDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTimeDropdown]);

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
      // Save search history with longer debounce to only record final input
      if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
      if (value.trim()) {
        historyDebounceRef.current = setTimeout(() => {
          addSearchHistory(value.trim()).catch(() => {});
        }, 1000);
      }
    },
    [setKeyword]
  );

  const handleClear = useCallback(() => {
    setInputValue("");
    setKeyword("");
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    inputRef.current?.focus();
  }, [setKeyword]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    };
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
  }, []);

  const handleHistoryClick = useCallback((historyKeyword: string) => {
    setInputValue(historyKeyword);
    setKeyword(historyKeyword);
    inputRef.current?.focus();
  }, [setKeyword]);

  const handleDeleteHistory = useCallback((id: number) => {
    deleteSearchHistory(id).then(() => {
      getSearchHistory(8).then(setSearchHistory).catch(() => {});
    }).catch(() => {});
  }, []);

  const handleClearAllHistory = useCallback(() => {
    clearSearchHistory().then(() => setSearchHistory([])).catch(() => {});
  }, []);

  const handleTimeRangeSelect = useCallback((value: TimeRange) => {
    setTimeRange(value);
    setShowTimeDropdown(false);
  }, [setTimeRange]);

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: "all", label: t("search.timeAll") },
    { value: "today", label: t("search.timeToday") },
    { value: "3days", label: t("search.time3Days") },
    { value: "week", label: t("search.timeWeek") },
    { value: "month", label: t("search.timeMonth") },
    { value: "3months", label: t("search.time3Months") },
  ];

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Search input row */}
      <div className="relative flex items-center">
        {/* Left icon: regex indicator or search icon */}
        {isRegexMode ? (
          <span className="pointer-events-none absolute left-3 text-xs font-mono font-bold text-primary">.*</span>
        ) : (
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        )}

        <input
          ref={inputRef}
          aria-label={t("searchBar.placeholder")}
          placeholder={t("searchBar.placeholder")}
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full h-8 rounded-lg border-[1.5px] border-border/60 bg-accent/30 py-1.5 pl-9 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/70 focus:bg-card focus:border-primary/30 focus:ring-3 focus:ring-ring/8",
            isHovered ? "pr-16" : "pr-9"
          )}
        />

        {/* Clear button */}
        {inputValue && (
          <button
            onClick={handleClear}
            aria-label={t("tags.cancel")}
            className={cn(
              "absolute flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent/70 hover:text-foreground",
              isHovered ? "right-8" : "right-2"
            )}
          >
            <X className="w-3 h-3" />
          </button>
        )}

        {/* Time filter button - only visible on hover */}
        {isHovered && (
          <button
            onClick={() => setShowTimeDropdown(!showTimeDropdown)}
            className={cn(
              "absolute right-1 flex h-6 w-6 items-center justify-center rounded-full transition-colors",
              timeRange !== "all" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            title={t("search.timeFilter")}
          >
            <Calendar className="w-3.5 h-3.5" />
            {timeRange !== "all" && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
            )}
          </button>
        )}

        {/* Show time filter indicator when not hovered but filter is active */}
        {!isHovered && timeRange !== "all" && (
          <span className="absolute right-2 flex h-4 w-4 items-center justify-center">
            <Calendar className="w-3 h-3 text-primary" />
          </span>
        )}
      </div>

      {/* Time range dropdown */}
      {showTimeDropdown && (
        <div
          ref={timeDropdownRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border/60 bg-card shadow-lg overflow-hidden"
        >
          {timeRangeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleTimeRangeSelect(opt.value)}
              className={cn(
                "w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent/50",
                timeRange === opt.value && "text-primary font-medium"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Search history dropdown - only when hovered, empty input, has history */}
      {isHovered && !inputValue.trim() && searchHistory.length > 0 && !showTimeDropdown && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-lg border border-border/60 bg-card shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 text-xs text-muted-foreground">{t("search.recentSearches")}</div>
          {searchHistory.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-1 px-3 py-1.5 hover:bg-accent/50 cursor-pointer group"
            >
              <button
                className="flex-1 text-left text-sm text-foreground truncate"
                onClick={() => handleHistoryClick(item.keyword)}
              >
                {item.keyword}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteHistory(item.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={handleClearAllHistory}
            className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors border-t border-border/30"
          >
            {t("search.clearHistory")}
          </button>
        </div>
      )}
    </div>
  );
}
