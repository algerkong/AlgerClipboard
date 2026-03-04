import { memo, useCallback } from "react";
import { Star, Trash2, FileText, ImageIcon, FolderOpen } from "lucide-react";
import { useClipboardStore } from "@/stores/clipboardStore";
import { pasteEntry } from "@/services/clipboardService";
import type { ClipboardEntry } from "@/types";
import { cn } from "@/lib/utils";

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}

function getPreview(entry: ClipboardEntry): string {
  if (entry.content_type === "PlainText" || entry.content_type === "RichText") {
    const text = entry.text_content ?? "";
    return text.length > 120 ? text.substring(0, 120) + "\u2026" : text;
  }
  if (entry.content_type === "Image") return "Image";
  return entry.text_content ?? "File";
}

function getIcon(type: string) {
  switch (type) {
    case "Image": return <ImageIcon className="w-3 h-3 text-blue-400/70" />;
    case "FilePaths": return <FolderOpen className="w-3 h-3 text-amber-400/70" />;
    default: return <FileText className="w-3 h-3 text-muted-foreground/40" />;
  }
}

export const EntryCard = memo(function EntryCard({ entry }: { entry: ClipboardEntry }) {
  const selectedId = useClipboardStore((s) => s.selectedId);
  const selectEntry = useClipboardStore((s) => s.selectEntry);
  const toggleFavorite = useClipboardStore((s) => s.toggleFavorite);
  const deleteEntries = useClipboardStore((s) => s.deleteEntries);
  const isSelected = selectedId === entry.id;

  const handleClick = useCallback(() => selectEntry(entry.id), [entry.id, selectEntry]);
  const handleDoubleClick = useCallback(() => {
    pasteEntry(entry.id).catch(console.error);
  }, [entry.id]);

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "group relative px-3 py-2 cursor-pointer transition-colors border-b border-border/20",
        isSelected
          ? "bg-primary/10 border-l-2 border-l-primary"
          : "hover:bg-accent/30 border-l-2 border-l-transparent"
      )}
    >
      {/* Content */}
      <div className="flex items-start gap-2 min-w-0">
        <div className="mt-0.5 shrink-0">{getIcon(entry.content_type)}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] leading-relaxed text-foreground/90 line-clamp-2 break-all">
            {getPreview(entry)}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground/50">
            <span>{formatTimeAgo(entry.created_at)}</span>
            {entry.source_app && (
              <>
                <span>·</span>
                <span className="truncate max-w-[80px]">{entry.source_app}</span>
              </>
            )}
            {entry.is_favorite && (
              <Star className="w-2.5 h-2.5 fill-yellow-400/80 text-yellow-400/80 ml-auto" />
            )}
          </div>
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(entry.id); }}
          className={cn(
            "p-1 rounded transition-colors",
            entry.is_favorite ? "text-yellow-400" : "text-muted-foreground/40 hover:text-yellow-400"
          )}
        >
          <Star className={cn("w-3 h-3", entry.is_favorite && "fill-current")} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); deleteEntries([entry.id]); }}
          className="p-1 rounded text-muted-foreground/40 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
});
