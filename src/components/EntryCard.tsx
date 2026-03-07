import { memo, useCallback, useState, useEffect, useMemo, useRef } from "react";
import { Star, Trash2, FileText, ImageIcon, FolderOpen, Languages, Pin, Eye, Copy, ClipboardPaste, Maximize2, Cloud, Upload, CloudAlert, ScanText, Code, Tag, X, ExternalLink, Brain } from "lucide-react";

import DOMPurify from "dompurify";
import { useClipboardStore } from "@/stores/clipboardStore";
import { useCapabilityStore } from "@/stores/capabilityStore";
import { pasteEntry, getThumbnailBase64 } from "@/services/clipboardService";
import { openUrl } from "@/services/settingsService";
import type { ClipboardEntry } from "@/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { openImageViewer } from "@/services/imageViewerService";
import { openDetailWindow } from "@/services/detailWindowService";
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

function formatCopyTime(dateStr: string): string {
  const date = new Date(dateStr);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `${hours}:${minutes}`;
  }
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
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
    case "RichText": return <Code className="w-3 h-3 text-purple-400/70" />;
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

// Negative lookahead stops before another http(s):// so encoded-space runs don't merge URLs
const URL_REGEX = /https?:\/\/(?:(?!https?:\/\/)[^\s<>"{}|\\^`[\]])+/gi;

function extractUrls(text: string | null): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  const cleaned = matches.map((url) =>
    url
      // Trim trailing URL-encoded whitespace (%20, %09, %0A, %0D)
      .replace(/(%20|%09|%0[aAdD])+$/gi, "")
      // Trim trailing punctuation unlikely to be part of the URL
      .replace(/[.,;:!]+$/, "")
  );
  return [...new Set(cleaned)].filter((url) => url.length > 10);
}

function truncateUrl(url: string, max = 40): string {
  if (url.length <= max) return url;
  return url.substring(0, max - 1) + "\u2026";
}

export const EntryCard = memo(function EntryCard({
  entry,
  shortcutNumber = null,
}: {
  entry: ClipboardEntry;
  shortcutNumber?: number | null;
}) {
  const { t } = useTranslation();
  const selectedId = useClipboardStore((s) => s.selectedId);
  const selectEntry = useClipboardStore((s) => s.selectEntry);
  const toggleFavorite = useClipboardStore((s) => s.toggleFavorite);
  const togglePin = useClipboardStore((s) => s.togglePin);
  const deleteEntries = useClipboardStore((s) => s.deleteEntries);
  const addTag = useClipboardStore((s) => s.addTag);
  const removeTag = useClipboardStore((s) => s.removeTag);
  const allTags = useClipboardStore((s) => s.allTags);
  const fetchAllTags = useClipboardStore((s) => s.fetchAllTags);
  const canTranslate = useCapabilityStore((s) => s.can_translate);
  const hasAi = useCapabilityStore((s) => s.has_ai);
  const isSelected = selectedId === entry.id;
  const [showUrlPicker, setShowUrlPicker] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [showTagInput, setShowTagInput] = useState(false);
  const [tagInputValue, setTagInputValue] = useState("");
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagEditorRef = useRef<HTMLDivElement>(null);
  const hasText = entry.content_type === "PlainText" || entry.content_type === "RichText";
  const isRichText = entry.content_type === "RichText" && !!entry.html_content;
  const isImage = entry.content_type === "Image";


  const urls = useMemo(() => extractUrls(entry.text_content), [entry.text_content]);

  const sanitizedHtml = useMemo(() => {
    if (!isRichText || !entry.html_content) return "";
    return DOMPurify.sanitize(entry.html_content, {
      ALLOWED_TAGS: ["b", "i", "u", "em", "strong", "s", "span", "br", "p", "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "code", "pre", "sub", "sup", "table", "tr", "td", "th", "thead", "tbody"],
      ALLOWED_ATTR: ["style", "href"],
    });
  }, [isRichText, entry.html_content]);
  const showTranslateHint = canTranslate && hasText && entry.text_content
    ? isNonChinese(entry.text_content)
    : false;
  const imageSrc = useImageSrc(entry);
  const availableTags = useMemo(() => {
    const query = tagInputValue.trim().toLowerCase();
    return allTags.filter((tag) => {
      if (entry.tags.includes(tag)) return false;
      if (!query) return true;
      return tag.toLowerCase().includes(query);
    }).slice(0, 8);
  }, [allTags, entry.tags, tagInputValue]);

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

  const closeTagInput = useCallback(() => {
    setShowTagInput(false);
    setTagInputValue("");
  }, []);

  const submitTag = useCallback(async (rawTag: string) => {
    const nextTag = rawTag.trim();
    if (!nextTag || entry.tags.includes(nextTag)) {
      return;
    }

    closeTagInput();
    await addTag(entry.id, nextTag);
  }, [addTag, closeTagInput, entry.id, entry.tags]);

  useEffect(() => {
    if (!showTagInput) return;

    void fetchAllTags();
    tagInputRef.current?.focus();

    const handleClickOutside = (event: MouseEvent) => {
      if (tagEditorRef.current && !tagEditorRef.current.contains(event.target as Node)) {
        closeTagInput();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeTagInput, fetchAllTags, showTagInput]);

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
      items.push({
        label: t("contextMenu.viewFull"),
        icon: <Eye className="w-3.5 h-3.5" />,
        onClick: () => openDetailWindow(entry.id, "view"),
      });
      items.push({
        label: t("contextMenu.copy"),
        icon: <Copy className="w-3.5 h-3.5" />,
        onClick: async () => {
          await navigator.clipboard.writeText(entry.text_content!);
          toast.success(t("toast.copied"));
        },
      });
      if (urls.length === 1) {
        items.push({
          label: t("contextMenu.openInBrowser"),
          icon: <ExternalLink className="w-3.5 h-3.5" />,
          onClick: () => {
            openUrl(urls[0]).catch(() => toast.error(t("toast.openUrlFailed")));
          },
        });
      } else if (urls.length > 1) {
        items.push({
          label: `${t("contextMenu.openInBrowser")} (${urls.length})`,
          icon: <ExternalLink className="w-3.5 h-3.5" />,
          onClick: () => setShowUrlPicker(true),
        });
      }
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

    if (canTranslate && hasText && entry.text_content) {
      items.push({
        label: t("contextMenu.translate"),
        icon: <Languages className="w-3.5 h-3.5" />,
        onClick: () => openDetailWindow(entry.id, "translate"),
      });
    }

    if (hasAi && hasText && entry.content_type !== "FilePaths") {
      items.push({
        label: entry.ai_summary ? t("contextMenu.resummarize") : t("contextMenu.aiSummarize"),
        icon: <Brain className="w-3.5 h-3.5" />,
        onClick: () => openDetailWindow(entry.id, "ai"),
      });
    }

    items.push({
      label: t("contextMenu.addTag"),
      icon: <Tag className="w-3.5 h-3.5" />,
      onClick: () => setShowTagInput(true),
      divider: true,
    });

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
      {shortcutNumber !== null && (
        <div className="absolute left-2 top-2 z-20 flex h-5 min-w-5 items-center justify-center rounded-md border border-primary/40 bg-background/95 px-1 text-xs font-semibold text-primary shadow-sm">
          {shortcutNumber}
        </div>
      )}

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
          ) : isRichText ? (
            <div
              className="text-base2 leading-relaxed text-foreground line-clamp-2 break-all rich-text-preview"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              onClick={(e) => {
                const anchor = (e.target as HTMLElement).closest("a");
                if (anchor) {
                  e.preventDefault();
                  e.stopPropagation();
                  const href = anchor.getAttribute("href");
                  if (href && /^https?:\/\//i.test(href)) {
                    openUrl(href).catch(() => toast.error(t("toast.openUrlFailed")));
                  }
                }
              }}
            />
          ) : (
            <p className="text-base2 leading-relaxed text-foreground line-clamp-2 break-all">
              {getPreview(entry, t)}
            </p>
          )}
          {entry.ai_summary && (
            <p className="text-xs2 text-muted-foreground/80 mt-1 line-clamp-1 italic">
              {entry.ai_summary}
            </p>
          )}
          {(entry.content_category && entry.content_category !== "General") && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="inline-flex items-center px-1.5 py-0 rounded text-2xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {entry.content_category}
              </span>
              {entry.detected_language && (
                <span className="inline-flex items-center px-1.5 py-0 rounded text-2xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {entry.detected_language}
                </span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1 text-xs2 text-muted-foreground">
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
            <span className="ml-auto flex items-center gap-1.5 shrink-0">
              {showTranslateHint && (
                <button
                  onClick={(e) => { e.stopPropagation(); openDetailWindow(entry.id, "translate"); }}
                  className="flex items-center gap-0.5 text-blue-400/80 hover:text-blue-400 transition-colors"
                >
                  <Languages className="w-2.5 h-2.5" />
                  <span className="text-2xs">{t("viewer.translateHint")}</span>
                </button>
              )}
              {entry.is_favorite && (
                <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
              )}
              <span className="text-muted-foreground/50">{formatCopyTime(entry.created_at)}</span>
            </span>
          </div>
          {/* Tags */}
          {entry.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {entry.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded-full text-2xs font-medium bg-primary/10 text-primary border border-primary/20"
                >
                  {tag}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTag(entry.id, tag); }}
                    className="hover:text-red-400 transition-colors"
                  >
                    <X className="w-2 h-2" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* Tag input */}
          {showTagInput && (
            <div
              ref={tagEditorRef}
              className="mt-1 rounded-lg border border-border/40 bg-muted/10 p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-1">
                <input
                  ref={tagInputRef}
                  type="text"
                  value={tagInputValue}
                  onChange={(e) => setTagInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && tagInputValue.trim()) {
                      void submitTag(tagInputValue);
                    } else if (e.key === "Escape") {
                      closeTagInput();
                    }
                  }}
                  placeholder={t("tags.addPlaceholder")}
                  className="h-7 min-w-0 flex-1 rounded-md border border-border/50 bg-background/80 px-2 text-xs2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring/30"
                />
                <button
                  onClick={() => void submitTag(tagInputValue)}
                  disabled={!tagInputValue.trim()}
                  className="h-7 rounded-md bg-primary/15 px-2 text-xs2 font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
                >
                  {t("tags.add")}
                </button>
                <button
                  onClick={closeTagInput}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="mt-2 space-y-1">
                <p className="text-2xs text-muted-foreground">
                  {t("tags.existing")}
                </p>
                {availableTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => void submitTag(tag)}
                        className="rounded-full border border-border/50 bg-background/80 px-2 py-1 text-2xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-2xs text-muted-foreground/70">
                    {t("tags.noSuggestions")}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute right-1.5 top-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-background/90 backdrop-blur-sm rounded-md shadow-sm border border-border/30 px-0.5">
        {isImage && (
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenImageViewer(); }}
            className="p-1 rounded text-muted-foreground hover:text-blue-400 transition-colors"
            title={t("imageViewer.extractText")}
          >
            <ScanText className="w-3 h-3" />
          </button>
        )}
        {urls.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (urls.length === 1) {
                openUrl(urls[0]).catch(() => toast.error(t("toast.openUrlFailed")));
              } else {
                setShowUrlPicker(true);
              }
            }}
            className="p-1 rounded text-muted-foreground hover:text-blue-400 transition-colors"
            title={urls.length > 1 ? `${t("contextMenu.openInBrowser")} (${urls.length})` : t("contextMenu.openInBrowser")}
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
        {hasText && (
          <button
            onClick={(e) => { e.stopPropagation(); openDetailWindow(entry.id, "view"); }}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            title={t("contextMenu.viewFull")}
          >
            <Maximize2 className="w-3 h-3" />
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

      {/* URL picker dialog */}
      {showUrlPicker && urls.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => { e.stopPropagation(); setShowUrlPicker(false); }}
        >
          <div
            className="bg-background border border-border rounded-lg shadow-xl w-80 max-h-60 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
              <span className="text-sm font-medium">{t("contextMenu.openInBrowser")} ({urls.length})</span>
              <button onClick={() => setShowUrlPicker(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-48 p-1">
              {urls.map((url, i) => (
                <button
                  key={i}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm hover:bg-accent/50 transition-colors"
                  onClick={() => {
                    openUrl(url).catch(() => toast.error(t("toast.openUrlFailed")));
                    setShowUrlPicker(false);
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                  <span className="truncate text-foreground">{truncateUrl(url, 50)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
