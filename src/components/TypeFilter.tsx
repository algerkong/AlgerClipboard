import { useEffect, useCallback } from "react";
import { AlignLeft, Image, FolderOpen, Star, LayoutGrid } from "lucide-react";
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
            "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
            isActive(item)
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          {item.icon}
          <span>{t(item.labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
