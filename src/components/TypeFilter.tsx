import { AlignLeft, Image, FolderOpen, Star, LayoutGrid } from "lucide-react";
import { useClipboardStore } from "@/stores/clipboardStore";
import type { ContentType } from "@/types";
import { cn } from "@/lib/utils";

const filters: { label: string; icon: React.ReactNode; filter: ContentType | null; isFavorites?: boolean }[] = [
  { label: "All", icon: <LayoutGrid className="w-3 h-3" />, filter: null },
  { label: "Text", icon: <AlignLeft className="w-3 h-3" />, filter: "PlainText" },
  { label: "Image", icon: <Image className="w-3 h-3" />, filter: "Image" },
  { label: "File", icon: <FolderOpen className="w-3 h-3" />, filter: "FilePaths" },
  { label: "Starred", icon: <Star className="w-3 h-3" />, filter: null, isFavorites: true },
];

export function TypeFilter() {
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

  const isActive = (item: typeof filters[0]) => {
    if (item.isFavorites) return showFavoritesOnly;
    if (showFavoritesOnly) return false;
    return typeFilter === item.filter;
  };

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/30">
      {filters.map((item) => (
        <button
          key={item.label}
          onClick={() => handleClick(item)}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors",
            isActive(item)
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground/60 hover:text-foreground hover:bg-accent/50"
          )}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
