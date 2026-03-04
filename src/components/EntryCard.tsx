import { memo, useCallback } from "react";
import { Star, Trash2, FileText, Image, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClipboardStore } from "@/stores/clipboardStore";
import { pasteEntry } from "@/services/clipboardService";
import type { ClipboardEntry } from "@/types";
import { cn } from "@/lib/utils";

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function getPreviewText(entry: ClipboardEntry): string {
  if (
    entry.content_type === "PlainText" ||
    entry.content_type === "RichText"
  ) {
    const text = entry.text_content ?? "";
    return text.length > 200 ? text.substring(0, 200) + "..." : text;
  }
  if (entry.content_type === "Image") return "[Image]";
  if (entry.content_type === "FilePaths") {
    const text = entry.text_content ?? "[File]";
    return text.length > 200 ? text.substring(0, 200) + "..." : text;
  }
  return "[Unknown]";
}

function getTypeIcon(entry: ClipboardEntry) {
  switch (entry.content_type) {
    case "PlainText":
    case "RichText":
      return <FileText className="size-3 text-muted-foreground" />;
    case "Image":
      return <Image className="size-3 text-muted-foreground" />;
    case "FilePaths":
      return <FolderOpen className="size-3 text-muted-foreground" />;
    default:
      return null;
  }
}

interface EntryCardProps {
  entry: ClipboardEntry;
}

export const EntryCard = memo(function EntryCard({ entry }: EntryCardProps) {
  const selectedId = useClipboardStore((s) => s.selectedId);
  const selectEntry = useClipboardStore((s) => s.selectEntry);
  const toggleFavorite = useClipboardStore((s) => s.toggleFavorite);
  const deleteEntries = useClipboardStore((s) => s.deleteEntries);

  const isSelected = selectedId === entry.id;

  const handleClick = useCallback(() => {
    selectEntry(entry.id);
  }, [entry.id, selectEntry]);

  const handleDoubleClick = useCallback(() => {
    pasteEntry(entry.id).catch((err) =>
      console.error("Failed to paste:", err)
    );
  }, [entry.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        pasteEntry(entry.id).catch((err) =>
          console.error("Failed to paste:", err)
        );
      }
    },
    [entry.id]
  );

  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleFavorite(entry.id);
    },
    [entry.id, toggleFavorite]
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      deleteEntries([entry.id]);
    },
    [entry.id, deleteEntries]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group flex flex-col gap-1 px-3 py-2 cursor-pointer border-b border-border transition-colors",
        "hover:bg-accent/50",
        isSelected && "bg-accent"
      )}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm leading-snug break-all line-clamp-3 flex-1">
          {getPreviewText(entry)}
        </p>
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleToggleFavorite}
            className="hover:bg-transparent"
          >
            <Star
              className={cn(
                "size-3.5",
                entry.is_favorite
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground"
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDelete}
            className="hover:bg-transparent hover:text-destructive"
          >
            <Trash2 className="size-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {getTypeIcon(entry)}
        <span>{entry.content_type}</span>
        {entry.source_app && (
          <>
            <span className="text-border">|</span>
            <span className="truncate max-w-[100px]">
              {entry.source_app}
            </span>
          </>
        )}
        <span className="ml-auto">{formatTimeAgo(entry.created_at)}</span>
      </div>
      {entry.is_favorite && (
        <Star className="absolute top-2 right-2 size-3 fill-yellow-400 text-yellow-400 hidden" />
      )}
    </div>
  );
});
