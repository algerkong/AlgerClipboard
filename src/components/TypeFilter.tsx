import { useEffect, useCallback, useState, useRef } from "react";
import { AlignLeft, Image, FolderOpen, Star, LayoutGrid, Tag } from "lucide-react";
import { useClipboardStore } from "@/stores/clipboardStore";
import type { ContentType } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const filters: { labelKey: string; icon: React.ReactNode; filter: ContentType | null; isFavorites?: boolean }[] = [
  { labelKey: "typeFilter.all", icon: <LayoutGrid className="w-3 h-3" />, filter: null },
  { labelKey: "typeFilter.text", icon: <AlignLeft className="w-3 h-3" />, filter: "PlainText" },
  { labelKey: "typeFilter.image", icon: <Image className="w-3 h-3" />, filter: "Image" },
  { labelKey: "typeFilter.file", icon: <FolderOpen className="w-3 h-3" />, filter: "FilePaths" },
  { labelKey: "typeFilter.starred", icon: <Star className="w-3 h-3" />, filter: null, isFavorites: true },
];

export function TypeFilter() {
  const { t } = useTranslation();
  const typeFilter = useClipboardStore((s) => s.typeFilter);
  const showFavoritesOnly = useClipboardStore((s) => s.showFavoritesOnly);
  const setTypeFilter = useClipboardStore((s) => s.setTypeFilter);
  const setShowFavoritesOnly = useClipboardStore((s) => s.setShowFavoritesOnly);
  const tagFilter = useClipboardStore((s) => s.tagFilter);
  const setTagFilter = useClipboardStore((s) => s.setTagFilter);
  const allTags = useClipboardStore((s) => s.allTags);
  const fetchAllTags = useClipboardStore((s) => s.fetchAllTags);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAllTags();
  }, [fetchAllTags]);

  useEffect(() => {
    if (!showTagDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setShowTagDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showTagDropdown]);

  const handleClick = (item: typeof filters[0]) => {
    if (item.isFavorites) {
      setShowFavoritesOnly(!showFavoritesOnly);
    } else {
      setShowFavoritesOnly(false);
      setTypeFilter(item.filter);
    }
  };

  const getActiveIndex = useCallback(() => {
    if (showFavoritesOnly) return filters.findIndex((f) => f.isFavorites);
    return filters.findIndex((f) => !f.isFavorites && f.filter === typeFilter);
  }, [typeFilter, showFavoritesOnly]);

  const isActive = (item: typeof filters[0]) => {
    if (item.isFavorites) return showFavoritesOnly;
    if (showFavoritesOnly) return false;
    return typeFilter === item.filter;
  };

  // Left/Right arrow keys to switch tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      e.preventDefault();
      const idx = getActiveIndex();
      let next: number;
      if (e.key === "ArrowLeft") {
        next = idx <= 0 ? filters.length - 1 : idx - 1;
      } else {
        next = idx >= filters.length - 1 ? 0 : idx + 1;
      }
      handleClick(filters[next]);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [getActiveIndex, typeFilter, showFavoritesOnly]);

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/30">
      {filters.map((item) => (
        <button
          key={item.labelKey}
          onClick={() => handleClick(item)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-sm2 font-medium transition-colors",
            isActive(item) && !tagFilter
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          {item.icon}
          <span>{t(item.labelKey)}</span>
        </button>
      ))}
      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="relative ml-auto" ref={tagDropdownRef}>
          <button
            onClick={() => setShowTagDropdown((v) => !v)}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-sm2 font-medium transition-colors",
              tagFilter
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            <Tag className="w-3 h-3" />
            <span>{tagFilter ?? t("typeFilter.tag")}</span>
          </button>
          {showTagDropdown && (
            <div className="absolute right-0 top-full mt-1 z-50 w-36 max-h-40 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg py-1 animate-fade-in">
              <button
                onClick={() => { setTagFilter(null); setShowTagDropdown(false); }}
                className={cn(
                  "w-full text-left px-3 py-1.5 text-sm2 hover:bg-accent/50 transition-colors",
                  !tagFilter && "text-primary font-medium"
                )}
              >
                {t("typeFilter.all")}
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => { setTagFilter(tag); setShowTagDropdown(false); }}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-sm2 hover:bg-accent/50 transition-colors",
                    tagFilter === tag && "text-primary font-medium"
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
