import {
  AlignLeft,
  Image,
  FolderOpen,
  Star,
  LayoutList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useClipboardStore } from "@/stores/clipboardStore";
import type { ContentType } from "@/types";
import { cn } from "@/lib/utils";

interface FilterItem {
  label: string;
  icon: React.ReactNode;
  filter: ContentType | null;
  isFavorites?: boolean;
}

const filters: FilterItem[] = [
  { label: "All", icon: <LayoutList className="size-4" />, filter: null },
  {
    label: "Text",
    icon: <AlignLeft className="size-4" />,
    filter: "PlainText",
  },
  { label: "Image", icon: <Image className="size-4" />, filter: "Image" },
  {
    label: "File",
    icon: <FolderOpen className="size-4" />,
    filter: "FilePaths",
  },
  {
    label: "Favorites",
    icon: <Star className="size-4" />,
    filter: null,
    isFavorites: true,
  },
];

export function TypeFilter() {
  const typeFilter = useClipboardStore((s) => s.typeFilter);
  const showFavoritesOnly = useClipboardStore((s) => s.showFavoritesOnly);
  const setTypeFilter = useClipboardStore((s) => s.setTypeFilter);
  const setShowFavoritesOnly = useClipboardStore(
    (s) => s.setShowFavoritesOnly
  );

  const handleClick = (item: FilterItem) => {
    if (item.isFavorites) {
      setShowFavoritesOnly(!showFavoritesOnly);
    } else {
      setTypeFilter(item.filter);
    }
  };

  const isActive = (item: FilterItem) => {
    if (item.isFavorites) return showFavoritesOnly;
    if (showFavoritesOnly) return false;
    return typeFilter === item.filter;
  };

  return (
    <div className="flex flex-col gap-1 p-1">
      {filters.map((item) => (
        <Tooltip key={item.label}>
          <TooltipTrigger asChild>
            <Button
              variant={isActive(item) ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "justify-start gap-2 h-8 w-full",
                isActive(item) && "bg-accent font-medium"
              )}
              onClick={() => handleClick(item)}
            >
              {item.icon}
              <span className="text-xs truncate">{item.label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{item.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
