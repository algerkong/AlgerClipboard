import { memo, useCallback, useState, useEffect, useMemo, useRef } from "react";
import { Star, Trash2, FileText, ImageIcon, FolderOpen, Languages, Pin, Eye, Copy, ClipboardPaste, Maximize2, Cloud, Upload, CloudAlert, Code, Tag, X, ExternalLink, Brain, Sparkles, File, Video, Music, Archive, FileCode, FileType as FileTypeIcon, Folder, QrCode } from "lucide-react";

import { useClipboardStore } from "@/stores/clipboardStore";
import { useCapabilityStore } from "@/stores/capabilityStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { pasteEntry, getThumbnailBase64 } from "@/services/clipboardService";
import { openUrl } from "@/services/settingsService";
import type { ClipboardEntry, FileMeta } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { openFileViewer } from "@/services/fileViewerService";
import { openInFileExplorer, openFileDefault } from "@/services/clipboardService";
import { cn } from "@/lib/utils";
import { highlightText, getSearchSnippet } from "@/lib/highlightText";
import { useTranslation } from "react-i18next";
import { openImageViewer } from "@/services/imageViewerService";
import { openDetailWindow } from "@/services/detailWindowService";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { SourceBadge } from "@/components/SourceBadge";
import { PresetSelector } from "@/components/PresetSelector";
import { useAskAiStore } from "@/stores/askAiStore";
import { toast } from "@/lib/toast";
import { sanitizePreviewHtml } from "@/lib/richText";
import QRCode from "qrcode";

// In-memory cache: relative_path -> data URL
const _thumbCache = new Map<string, string>();

// In-memory cache: source_icon (base64) -> dominant color string
const _iconColorCache = new Map<string, string>();

function extractDominantColor(iconSrc: string): Promise<string> {
  const cached = _iconColorCache.get(iconSrc);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 16;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(""); return; }
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;

      // Simple: find the most saturated, non-gray pixel
      let bestR = 128, bestG = 128, bestB = 128, bestScore = -1;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue; // skip transparent
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const sat = max === 0 ? 0 : (max - min) / max;
        const lum = (r + g + b) / 3;
        // Prefer saturated, mid-luminance colors
        const score = sat * 2 + (1 - Math.abs(lum / 255 - 0.45));
        if (score > bestScore) {
          bestScore = score;
          bestR = r; bestG = g; bestB = b;
        }
      }
      const color = `rgb(${bestR}, ${bestG}, ${bestB})`;
      _iconColorCache.set(iconSrc, color);
      resolve(color);
    };
    img.onerror = () => resolve("");
    img.src = iconSrc;
  });
}

function useDominantColor(sourceIcon: string | null): string {
  const fallback = "";
  const [color, setColor] = useState(() => sourceIcon ? _iconColorCache.get(sourceIcon) ?? fallback : fallback);

  useEffect(() => {
    if (!sourceIcon) { setColor(fallback); return; }
    const cached = _iconColorCache.get(sourceIcon);
    if (cached) { setColor(cached); return; }
    let cancelled = false;
    extractDominantColor(sourceIcon).then((c) => {
      if (!cancelled && c) setColor(c);
    });
    return () => { cancelled = true; };
  }, [sourceIcon]);

  return color;
}

function useImageSrc(entry: ClipboardEntry): string | null {
  const path = entry.thumbnail_path ?? entry.blob_path;
  const [loadedImage, setLoadedImage] = useState<{ path: string; src: string } | null>(null);
  const src = path
    ? _thumbCache.get(path) ?? (loadedImage?.path === path ? loadedImage.src : null)
    : null;

  useEffect(() => {
    if (!path) return;
    if (entry.content_type !== "Image" && entry.content_type !== "FilePaths") return;
    if (_thumbCache.has(path)) {
      return;
    }
    let cancelled = false;
    getThumbnailBase64(path).then((dataUrl) => {
      if (cancelled) return;
      _thumbCache.set(path, dataUrl);
      setLoadedImage({ path, src: dataUrl });
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

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileTypeIcon(fileType: string) {
  switch (fileType) {
    case "Image": return <ImageIcon className="h-4 w-4 text-sky-400" />;
    case "Video": return <Video className="h-4 w-4 text-purple-400" />;
    case "Audio": return <Music className="h-4 w-4 text-pink-400" />;
    case "Document": return <FileText className="h-4 w-4 text-blue-400" />;
    case "Archive": return <Archive className="h-4 w-4 text-orange-400" />;
    case "Code": return <FileCode className="h-4 w-4 text-green-400" />;
    case "Executable": return <FileTypeIcon className="h-4 w-4 text-red-400" />;
    default: return <File className="h-4 w-4 text-gray-400" />;
  }
}

function getPreview(entry: ClipboardEntry, t: (key: string) => string, fileMetas?: FileMeta[]): string {
  if (entry.content_type === "PlainText" || entry.content_type === "RichText") {
    const text = entry.text_content ?? "";
    return text.length > 120 ? text.substring(0, 120) + "\u2026" : text;
  }
  if (entry.content_type === "Image") return t("entryCard.image");
  if (entry.content_type === "FilePaths" && fileMetas && fileMetas.length > 0) {
    if (fileMetas.length === 1) {
      return `${fileMetas[0].name}  (${formatFileSize(fileMetas[0].size)})`;
    }
    const totalSize = fileMetas.reduce((sum, f) => sum + f.size, 0);
    return `${fileMetas.length} files  (${formatFileSize(totalSize)})`;
  }
  return entry.text_content ?? t("entryCard.file");
}

function getIcon(type: string, fileMetas?: FileMeta[]) {
  switch (type) {
    case "Image": return <ImageIcon className="h-4 w-4 text-sky-400" />;
    case "FilePaths":
      if (fileMetas && fileMetas.length === 1) {
        if (fileMetas[0].is_dir) return <Folder className="h-4 w-4 text-amber-400" />;
        return getFileTypeIcon(fileMetas[0].file_type);
      }
      return <FolderOpen className="h-4 w-4 text-amber-400" />;
    case "RichText": return <Code className="h-4 w-4 text-violet-400" />;
    default: return <FileText className="h-4 w-4 text-teal-400" />;
  }
}

function getTypeLineColor(type: string): string {
  switch (type) {
    case "Image": return "oklch(0.55 0.18 155)";
    case "FilePaths": return "oklch(0.6 0.2 50)";
    case "RichText": return "oklch(0.55 0.22 300)";
    default: return "oklch(0.55 0.2 260)";
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
  const specialChars = (trimmed.match(/[{}()[\];=<>/\\|&^%$#@!~`]/g) || []).length;
  if (specialChars / trimmed.length > 0.15) return false;
  // JSON / key-value data
  if (/^\s*[{[]/.test(trimmed) && /[}\]]\s*$/.test(trimmed)) return false;

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
  const keyword = useClipboardStore((s) => s.keyword);
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
  const richTextPreview = useSettingsStore((s) => s.richTextPreview);
  const startAskAi = useAskAiStore((s) => s.startAskAi);
  const askAiEntryId = useAskAiStore((s) => s.askAiEntryId);
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
  const isFilePaths = entry.content_type === "FilePaths";

  const fileMetas: FileMeta[] = useMemo(() => {
    if (entry.content_type !== "FilePaths" || !entry.file_meta) return [];
    try {
      return JSON.parse(entry.file_meta);
    } catch {
      return [];
    }
  }, [entry.content_type, entry.file_meta]);


  const urls = useMemo(() => extractUrls(entry.text_content), [entry.text_content]);

  const sanitizedHtml = useMemo(() => {
    if (!isRichText || !entry.html_content) return "";
    return sanitizePreviewHtml(entry.html_content, richTextPreview);
  }, [entry.html_content, isRichText, richTextPreview]);
  const showRichTextPreview = isRichText && richTextPreview.enabled && !!sanitizedHtml.trim();
  const showTranslateHint = canTranslate && hasText && entry.text_content
    ? isNonChinese(entry.text_content)
    : false;
  const imageSrc = useImageSrc(entry);
  const dominantColor = useDominantColor(entry.source_icon);
  const typeLineColor = dominantColor || getTypeLineColor(entry.content_type);
  const availableTags = useMemo(() => {
    const query = tagInputValue.trim().toLowerCase();
    return allTags.filter((tag) => {
      if (entry.tags.includes(tag)) return false;
      if (!query) return true;
      return tag.toLowerCase().includes(query);
    }).slice(0, 8);
  }, [allTags, entry.tags, tagInputValue]);

  const handleClick = useCallback(() => selectEntry(entry.id), [entry.id, selectEntry]);
  const handlePaste = useCallback(() => {
    pasteEntry(entry.id)
      .then(() => toast.success(t("toast.pasted")))
      .catch(() => toast.error(t("toast.pasteFailed")));
  }, [entry.id, t]);
  const handleDoubleClick = useCallback(() => {
    handlePaste();
  }, [handlePaste]);

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
  const handleTogglePin = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    void togglePin(entry.id);
  }, [entry.id, togglePin]);
  const handleToggleFavorite = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    void toggleFavorite(entry.id);
  }, [entry.id, toggleFavorite]);

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

    if (isFilePaths) {
      items.push({
        label: t("contextMenu.previewFile"),
        icon: <Eye className="w-3.5 h-3.5" />,
        onClick: () => openFileViewer(entry.id),
      });
      if (fileMetas.length === 1) {
        items.push({
          label: t("contextMenu.openInExplorer"),
          icon: <FolderOpen className="w-3.5 h-3.5" />,
          onClick: () => {
            openInFileExplorer(fileMetas[0].path).catch(() => toast.error(t("toast.openUrlFailed")));
          },
        });
        items.push({
          label: t("contextMenu.openDefault"),
          icon: <ExternalLink className="w-3.5 h-3.5" />,
          onClick: () => {
            openFileDefault(fileMetas[0].path).catch(() => toast.error(t("toast.openUrlFailed")));
          },
        });
      }
      items.push({
        label: t("contextMenu.copyFilePath"),
        icon: <Copy className="w-3.5 h-3.5" />,
        onClick: async () => {
          const paths = fileMetas.map(m => m.path).join("\n");
          await navigator.clipboard.writeText(paths || entry.text_content || "");
          toast.success(t("toast.copied"));
        },
      });
    }

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
      items.push({
        label: t("contextMenu.generateQrCode"),
        icon: <QrCode className="w-3.5 h-3.5" />,
        onClick: async () => {
          try {
            const base64 = await QRCode.toDataURL(entry.text_content!, { width: 400, margin: 2 });
            const relativePath = await invoke<string>("save_temp_blob", { base64Data: base64 });
            await openImageViewer(relativePath);
          } catch (err) {
            toast.error(String(err));
          }
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
      onClick: handlePaste,
    });

    items.push({
      label: entry.is_pinned ? t("contextMenu.unpin") : t("contextMenu.pin"),
      icon: <Pin className="w-3.5 h-3.5" />,
      onClick: () => void togglePin(entry.id),
      divider: true,
    });

    items.push({
      label: entry.is_favorite ? t("contextMenu.unfavorite") : t("contextMenu.favorite"),
      icon: <Star className="w-3.5 h-3.5" />,
      onClick: () => void toggleFavorite(entry.id),
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

  const renderContent = () => {
    // File paths with image thumbnail
    if (isFilePaths && fileMetas.length === 1 && fileMetas[0].file_type === "Image" && imageSrc) {
      return (
        <div className="flex items-start gap-2.5">
          <img
            src={imageSrc}
            alt={fileMetas[0].name}
            className="h-[42px] w-14 shrink-0 rounded-lg border border-border/30 object-cover cursor-zoom-in shadow-xs"
            draggable={false}
            onClick={(e) => { e.stopPropagation(); openFileViewer(entry.id); }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm2 font-medium text-foreground">{keyword ? highlightText(fileMetas[0].name, keyword) : fileMetas[0].name}</p>
            <p className="text-2xs text-muted-foreground">{formatFileSize(fileMetas[0].size)}</p>
          </div>
        </div>
      );
    }
    // Image with thumbnail
    if (isImage && imageSrc) {
      return (
        <div>
          <img
            src={imageSrc}
            alt=""
            className="max-h-[82px] max-w-full rounded-lg border border-border/30 object-cover cursor-zoom-in"
            draggable={false}
            onClick={(e) => { e.stopPropagation(); handleOpenImageViewer(); }}
          />
          {keyword && entry.ocr_text && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground break-all">
              {getSearchSnippet(entry.ocr_text, keyword, 100)}
            </p>
          )}
        </div>
      );
    }
    // File paths (non-image) — file info block
    if (isFilePaths && fileMetas.length > 0) {
      return (
        <div className="flex items-center gap-2.5 rounded-lg border px-2 py-1.5" style={{ background: "color-mix(in oklab, var(--muted) 30%, transparent)", borderColor: "color-mix(in oklab, var(--border) 50%, transparent)" }}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "color-mix(in oklab, var(--primary) 8%, transparent)" }}>
            {getIcon(entry.content_type, fileMetas)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm2 font-medium text-foreground">
              {fileMetas.length === 1
                ? (keyword ? highlightText(fileMetas[0].name, keyword) : fileMetas[0].name)
                : `${fileMetas.length} files`}
            </p>
            <p className="text-2xs text-muted-foreground">
              {formatFileSize(fileMetas.reduce((sum, f) => sum + f.size, 0))}
              {fileMetas.length === 1 && fileMetas[0].file_type !== "Other" && ` · ${fileMetas[0].file_type}`}
            </p>
          </div>
        </div>
      );
    }
    // Rich text preview
    if (showRichTextPreview) {
      return (
        <div
          className="rich-text-content rich-text-content--preview break-all text-base2 leading-relaxed text-foreground"
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
      );
    }
    // Plain text preview
    return (
      <p className="line-clamp-3 text-base2 leading-relaxed text-foreground break-all">
        {keyword && entry.text_content
          ? getSearchSnippet(entry.text_content, keyword, 120)
          : getPreview(entry, t, fileMetas)}
      </p>
    );
  };

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-lg border-[1.5px] border-transparent px-2.5 py-1.5 transition-all duration-200",
        isSelected
          ? "border-border/60 bg-accent/70"
          : "hover:border-border/60 hover:bg-accent/25"
      )}
    >
      {shortcutNumber !== null && (
        <div className="absolute right-2.5 top-2.5 z-20 flex h-5 min-w-5 items-center justify-center rounded-md border border-primary/35 bg-card/95 px-1 text-2xs font-semibold text-primary shadow-sm">
          {shortcutNumber}
        </div>
      )}

      {/* Floating action buttons — hover only */}
      <div className="absolute right-1.5 top-1.5 z-10 flex gap-px rounded-lg p-0.5 opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100" style={{ background: "color-mix(in oklab, var(--card) 92%, transparent)" }}>
              {hasText && entry.text_content && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startAskAi(entry.id, { x: e.clientX, y: e.clientY });
                  }}
                  className="flex items-center justify-center min-w-7 min-h-7 rounded-md border border-transparent cursor-pointer text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={t("askAi.askAi")}
                  aria-label={t("askAi.askAi")}
                >
                  <Sparkles className="h-3 w-3" />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePaste();
                }}
                className="flex items-center justify-center min-w-7 min-h-7 rounded-md border border-transparent cursor-pointer text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={t("contextMenu.paste")}
                aria-label={t("contextMenu.paste")}
              >
                <ClipboardPaste className="h-3 w-3" />
              </button>
              {isFilePaths && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openFileViewer(entry.id);
                  }}
                  className="flex items-center justify-center min-w-7 min-h-7 rounded-md border border-transparent cursor-pointer text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={t("contextMenu.previewFile")}
                  aria-label={t("contextMenu.previewFile")}
                >
                  <Eye className="h-3 w-3" />
                </button>
              )}
              {(hasText || isImage) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isImage) {
                      handleOpenImageViewer();
                    } else {
                      openDetailWindow(entry.id, "view");
                    }
                  }}
                  className="flex items-center justify-center min-w-7 min-h-7 rounded-md border border-transparent cursor-pointer text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={isImage ? t("contextMenu.viewImage") : t("contextMenu.viewFull")}
                  aria-label={isImage ? t("contextMenu.viewImage") : t("contextMenu.viewFull")}
                >
                  {isImage ? <Eye className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                </button>
              )}
              <button
                onClick={handleTogglePin}
                className={cn(
                  "flex items-center justify-center min-w-7 min-h-7 rounded-md border border-transparent cursor-pointer transition-all hover:bg-primary/10 hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  entry.is_pinned ? "text-primary" : "text-muted-foreground hover:text-primary"
                )}
                title={entry.is_pinned ? t("entryCard.unpin") : t("entryCard.pin")}
                aria-label={entry.is_pinned ? t("entryCard.unpin") : t("entryCard.pin")}
              >
                <Pin className={cn("h-3 w-3", entry.is_pinned && "fill-current")} />
              </button>
              <button
                onClick={handleToggleFavorite}
                className={cn(
                  "flex items-center justify-center min-w-7 min-h-7 rounded-md border border-transparent cursor-pointer transition-all hover:bg-primary/10 hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  entry.is_favorite ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"
                )}
                title={entry.is_favorite ? t("contextMenu.unfavorite") : t("contextMenu.favorite")}
                aria-label={entry.is_favorite ? t("contextMenu.unfavorite") : t("contextMenu.favorite")}
              >
                <Star className={cn("h-3 w-3", entry.is_favorite && "fill-current")} />
              </button>
      </div>

      {/* Type indicator line — flush left */}
      <div
        className={cn(
          "absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-opacity duration-150",
          isSelected ? "opacity-100" : "opacity-50 group-hover:opacity-75"
        )}
        style={{ background: typeLineColor }}
      />

      <div className="min-w-0 flex-1">
          {renderContent()}

          {/* AI summary block */}
          {entry.ai_summary && (
            <div className="mt-1.5 line-clamp-1 rounded-md border-l-2 px-2 py-0.5 text-[0.714rem] italic leading-snug text-muted-foreground" style={{ background: "color-mix(in oklab, var(--primary) 6%, transparent)", borderLeftColor: "color-mix(in oklab, var(--primary) 35%, transparent)" }}>
              {keyword ? highlightText(entry.ai_summary, keyword) : entry.ai_summary}
            </div>
          )}

          {/* Compact meta row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs2 text-muted-foreground">
            <span className="meta-pill inline-flex items-center gap-1 text-xs text-muted-foreground">{formatTimeAgo(entry.created_at)}</span>
            {entry.source_app && (
              <SourceBadge
                sourceApp={entry.source_app}
                sourceUrl={entry.source_url}
                sourceIcon={entry.source_icon}
                className="meta-pill inline-flex items-center gap-1 text-xs text-muted-foreground"
                textClassName="text-xs2 text-muted-foreground"
              />
            )}
            {entry.detected_language && (
              <span className="meta-pill inline-flex items-center gap-1 rounded bg-muted/40 px-1 py-px font-mono text-2xs text-muted-foreground">
                {entry.detected_language}
              </span>
            )}
            {entry.content_category && entry.content_category !== "General" && (
              <span className="meta-pill inline-flex items-center gap-1 text-xs text-muted-foreground">
                {entry.content_category}
              </span>
            )}
            {entry.is_pinned && (
              <span className="text-primary">
                <Pin className="h-2.5 w-2.5 fill-current" />
              </span>
            )}
            {entry.is_favorite && (
              <span className="text-yellow-400">
                <Star className="h-2.5 w-2.5 fill-current" />
              </span>
            )}
            {entry.sync_status !== "Local" && (
              <span className="inline-flex items-center">
                {entry.sync_status === "Synced" && <Cloud className="w-2.5 h-2.5 text-green-400/70" />}
                {entry.sync_status === "PendingSync" && <Upload className="w-2.5 h-2.5 text-blue-400/70" />}
                {entry.sync_status === "Conflict" && <CloudAlert className="w-2.5 h-2.5 text-amber-400/70" />}
              </span>
            )}
            {showTranslateHint && (
              <button
                onClick={(e) => { e.stopPropagation(); openDetailWindow(entry.id, "translate"); }}
                className="meta-pill inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline transition-all"
              >
                <Languages className="h-2.5 w-2.5" />
                <span>{t("viewer.translateHint")}</span>
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
                className="meta-pill inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline transition-all"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                <span>{urls.length > 1 ? `${urls.length} URLs` : truncateUrl(urls[0], 24)}</span>
              </button>
            )}
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 rounded bg-primary/8 px-1.5 py-px text-2xs font-medium text-primary"
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

          {/* Tag input */}
          {showTagInput && (
            <div
              ref={tagEditorRef}
              className="mt-2 rounded-2xl border border-border/50 bg-card/80 p-2.5"
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
                  className="h-8 min-w-0 flex-1 rounded-xl border border-border/60 bg-background/80 px-2.5 text-xs2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
                <button
                  onClick={() => void submitTag(tagInputValue)}
                  disabled={!tagInputValue.trim()}
                  className="h-8 rounded-xl bg-primary/15 px-3 text-xs2 font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
                >
                  {t("tags.add")}
                </button>
                <button
                  onClick={closeTagInput}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
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
                        className="meta-pill inline-flex items-center gap-1 text-xs text-muted-foreground"
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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}

      {askAiEntryId === entry.id && <PresetSelector />}

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
