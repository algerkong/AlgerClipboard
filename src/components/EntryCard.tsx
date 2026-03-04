import { memo, useCallback, useState, useEffect } from "react";
import { Star, Trash2, FileText, ImageIcon, FolderOpen, Languages, Pin, Eye, Copy, ClipboardPaste, Maximize2, Cloud, Upload, CloudAlert, ScanText } from "lucide-react";
import { useClipboardStore } from "@/stores/clipboardStore";
import { pasteEntry, getThumbnailBase64 } from "@/services/clipboardService";
import type { ClipboardEntry } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { TranslateDialog } from "@/components/TranslateDialog";
import { TextViewer } from "@/components/TextViewer";
import { openImageViewer } from "@/services/imageViewerService";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { toast } from "sonner";

// In-memory cache: relative_path -> data URL
const _thumbCache = new Map<string, string>();

function useImageSrc(entry: ClipboardEntry): string | null {
  const path = entry.thumbnail_path ?? entry.blob_path;
  const [src, setSrc] = useState<string | null>(path ? _thumbCache.get(path) ?? null : null);

  useEffect(() => {
    if (entry.content_type !== "Image" || !path) return;
    if (_thumbCache.has(path)) {
      setSrc(_thumbCache.get(path)!);
      return;
    }
    let cancelled = false;
    getThumbnailBase64(path).then((dataUrl) => {
      if (cancelled) return;
      _thumbCache.set(path, dataUrl);
      setSrc(dataUrl);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [entry.content_type, path]);

  return src;
}

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

function getPreview(entry: ClipboardEntry, t: (key: string) => string): string {
  if (entry.content_type === "PlainText" || entry.content_type === "RichText") {
    const text = entry.text_content ?? "";
    return text.length > 120 ? text.substring(0, 120) + "\u2026" : text;
  }
  if (entry.content_type === "Image") return t("entryCard.image");
  return entry.text_content ?? t("entryCard.file");
}

function getIcon(type: string) {
  switch (type) {
    case "Image": return <ImageIcon className="w-3 h-3 text-blue-400/70" />;
    case "FilePaths": return <FolderOpen className="w-3 h-3 text-amber-400/70" />;
    default: return <FileText className="w-3 h-3 text-muted-foreground/70" />;
  }
}

/** Check if text is natural-language non-Chinese (skip URLs, paths, code, etc.) */
function isNonChinese(text: string): boolean {
  const trimmed = text.trim();
  // Too short to be meaningful
  if (trimmed.length < 8) return false;
  // URL
  if (/^https?:\/\//i.test(trimmed)) return false;
  // File path (Windows or Unix)
  if (/^[A-Z]:\\|^\/[\w.]/i.test(trimmed)) return false;
  // Mostly URL-like (contains :// or www.)
  if (/\w+:\/\/\S+/.test(trimmed) && trimmed.split(/\s+/).length <= 3) return false;
  // Email
  if (/^\S+@\S+\.\S+$/.test(trimmed)) return false;
  // Code-like: too many special chars relative to letters
  const specialChars = (trimmed.match(/[{}()\[\];=<>\/\\|&^%$#@!~`]/g) || []).length;
  if (specialChars / trimmed.length > 0.15) return false;
  // JSON / key-value data
  if (/^\s*[{\[]/.test(trimmed) && /[}\]]\s*$/.test(trimmed)) return false;

  // Now check: is it actual non-Chinese natural language?
  const cleaned = trimmed.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (cleaned.length < 4) return false;
  const chineseChars = (cleaned.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  // Must have enough alphabetic content (real sentences)
  const latinChars = (cleaned.match(/[a-zA-Z]/g) || []).length;
  if (latinChars / cleaned.length < 0.5) return false;
  return chineseChars / cleaned.length < 0.3;
}

export const EntryCard = memo(function EntryCard({ entry }: { entry: ClipboardEntry }) {
  const { t } = useTranslation();
  const selectedId = useClipboardStore((s) => s.selectedId);
  const selectEntry = useClipboardStore((s) => s.selectEntry);
  const toggleFavorite = useClipboardStore((s) => s.toggleFavorite);
  const togglePin = useClipboardStore((s) => s.togglePin);
  const deleteEntries = useClipboardStore((s) => s.deleteEntries);
  const isSelected = selectedId === entry.id;
  const [showTranslate, setShowTranslate] = useState(false);
  const [showViewer, setShowViewer] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const hasText = entry.content_type === "PlainText" || entry.content_type === "RichText";
  const isImage = entry.content_type === "Image";
  const isLongText = hasText && (entry.text_content?.length ?? 0) > 120;
  const showTranslateHint = hasText && entry.text_content ? isNonChinese(entry.text_content) : false;
  const imageSrc = useImageSrc(entry);

  const handleClick = useCallback(() => selectEntry(entry.id), [entry.id, selectEntry]);
  const handleDoubleClick = useCallback(() => {
    pasteEntry(entry.id)
      .then(() => toast.success(t("toast.pasted")))
      .catch(() => toast.error(t("toast.pasteFailed")));
  }, [entry.id, t]);

  const handleOpenImageViewer = useCallback(() => {
    const blobPath = entry.blob_path;
    if (!blobPath) return;
    openImageViewer(blobPath);
  }, [entry.blob_path]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    selectEntry(entry.id);
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, [entry.id, selectEntry]);

  const getContextMenuItems = (): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    if (isImage) {
      items.push({
        label: t("contextMenu.viewImage"),
        icon: <Eye className="w-3.5 h-3.5" />,
        onClick: handleOpenImageViewer,
      });
    }

    if (hasText && entry.text_content) {
      if (isLongText) {
        items.push({
          label: t("contextMenu.viewFull"),
          icon: <Eye className="w-3.5 h-3.5" />,
          onClick: () => setShowViewer(true),
        });
      }
      items.push({
        label: t("contextMenu.copy"),
        icon: <Copy className="w-3.5 h-3.5" />,
        onClick: async () => {
          await navigator.clipboard.writeText(entry.text_content!);
          toast.success(t("toast.copied"));
        },
      });
    }

    items.push({
      label: t("contextMenu.paste"),
      icon: <ClipboardPaste className="w-3.5 h-3.5" />,
      onClick: () => {
        pasteEntry(entry.id)
          .then(() => toast.success(t("toast.pasted")))
          .catch(() => toast.error(t("toast.pasteFailed")));
      },
    });

    items.push({
      label: entry.is_pinned ? t("contextMenu.unpin") : t("contextMenu.pin"),
      icon: <Pin className="w-3.5 h-3.5" />,
      onClick: () => togglePin(entry.id),
      divider: true,
    });

    items.push({
      label: entry.is_favorite ? t("contextMenu.unfavorite") : t("contextMenu.favorite"),
      icon: <Star className="w-3.5 h-3.5" />,
      onClick: () => toggleFavorite(entry.id),
    });

    if (hasText && entry.text_content) {
      items.push({
        label: t("contextMenu.translate"),
        icon: <Languages className="w-3.5 h-3.5" />,
        onClick: () => setShowTranslate(true),
      });
    }

    items.push({
      label: t("contextMenu.delete"),
      icon: <Trash2 className="w-3.5 h-3.5" />,
      onClick: () => deleteEntries([entry.id]),
      danger: true,
      divider: true,
    });

    return items;
  };

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
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
          {isImage && imageSrc ? (
            <img
              src={imageSrc}
              alt=""
              className="max-h-[60px] max-w-full rounded object-cover cursor-zoom-in"
              draggable={false}
              onClick={(e) => { e.stopPropagation(); handleOpenImageViewer(); }}
            />
          ) : (
            <p className="text-[12px] leading-relaxed text-foreground line-clamp-2 break-all">
              {getPreview(entry, t)}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
            {entry.is_pinned && (
              <Pin className="w-2.5 h-2.5 text-primary fill-primary/30" />
            )}
            <span>{formatTimeAgo(entry.created_at)}</span>
            {entry.source_app && (
              <>
                <span>·</span>
                <span className="truncate max-w-[80px]">{entry.source_app}</span>
              </>
            )}
            {entry.sync_status !== "Local" && (
              <span className="flex items-center gap-0.5">
                <span>·</span>
                {entry.sync_status === "Synced" && <Cloud className="w-2.5 h-2.5 text-green-400/70" />}
                {entry.sync_status === "PendingSync" && <Upload className="w-2.5 h-2.5 text-blue-400/70" />}
                {entry.sync_status === "Conflict" && <CloudAlert className="w-2.5 h-2.5 text-amber-400/70" />}
              </span>
            )}
            {showTranslateHint && (
              <button
                onClick={(e) => { e.stopPropagation(); setShowTranslate(true); }}
                className="flex items-center gap-0.5 text-blue-400/80 hover:text-blue-400 transition-colors ml-auto"
              >
                <Languages className="w-2.5 h-2.5" />
                <span className="text-[9px]">{t("viewer.translateHint")}</span>
              </button>
            )}
            {!showTranslateHint && entry.is_favorite && (
              <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400 ml-auto" />
            )}
            {showTranslateHint && entry.is_favorite && (
              <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
            )}
          </div>
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm rounded-md shadow-sm border border-border/30 px-0.5">
        {isImage && (
          <button
            onClick={(e) => { e.stopPropagation(); openImageViewer(); }}
            className="p-1 rounded text-muted-foreground hover:text-blue-400 transition-colors"
            title={t("imageViewer.extractText")}
          >
            <ScanText className="w-3 h-3" />
          </button>
        )}
        {hasText && isLongText && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowViewer(true); }}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            title={t("contextMenu.viewFull")}
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        )}
        {hasText && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowTranslate(true); }}
            className="p-1 rounded text-muted-foreground hover:text-blue-400 transition-colors"
            title={t("translate.translate")}
          >
            <Languages className="w-3 h-3" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); togglePin(entry.id); }}
          className={cn(
            "p-1 rounded transition-colors",
            entry.is_pinned ? "text-primary" : "text-muted-foreground hover:text-primary"
          )}
          title={entry.is_pinned ? t("entryCard.unpin") : t("entryCard.pin")}
        >
          <Pin className={cn("w-3 h-3", entry.is_pinned && "fill-current")} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(entry.id); }}
          className={cn(
            "p-1 rounded transition-colors",
            entry.is_favorite ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"
          )}
        >
          <Star className={cn("w-3 h-3", entry.is_favorite && "fill-current")} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); deleteEntries([entry.id]); }}
          className="p-1 rounded text-muted-foreground hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Text viewer */}
      {showViewer && entry.text_content && (
        <TextViewer
          text={entry.text_content}
          onClose={() => setShowViewer(false)}
        />
      )}

      {/* Translate dialog */}
      {showTranslate && entry.text_content && (
        <TranslateDialog
          text={entry.text_content}
          onClose={() => setShowTranslate(false)}
        />
      )}
    </div>
  );
});
