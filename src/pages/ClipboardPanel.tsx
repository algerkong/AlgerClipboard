import { useEffect, useMemo, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import {
  ClipboardList,
  FileText,
  Loader2,
  Settings,
} from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { TypeFilter } from "@/components/TypeFilter";
import { EntryCard } from "@/components/EntryCard";
import { TemplateQuickPicker } from "@/components/TemplateQuickPicker";
import { useClipboardStore } from "@/stores/clipboardStore";
import { pasteEntry } from "@/services/clipboardService";
import { openImageViewer } from "@/services/imageViewerService";
import { openFileViewer } from "@/services/fileViewerService";
import { openDetailWindow } from "@/services/detailWindowService";
import { openUrl } from "@/services/settingsService";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { usePlatform } from "@/contexts/PlatformContext";
import { cn } from "@/lib/utils";

interface Props {
  onOpenSettings: () => void;
}

export function ClipboardPanel({ onOpenSettings }: Props) {
  const { t } = useTranslation();
  const platform = usePlatform();
  const entries = useClipboardStore((s) => s.entries);
  const totalCount = useClipboardStore((s) => s.totalCount);
  const loading = useClipboardStore((s) => s.loading);
  const typeFilter = useClipboardStore((s) => s.typeFilter);
  const keyword = useClipboardStore((s) => s.keyword);
  const showFavoritesOnly = useClipboardStore((s) => s.showFavoritesOnly);
  const showTagPanel = useClipboardStore((s) => s.showTagPanel);
  const selectedId = useClipboardStore((s) => s.selectedId);
  const selectEntry = useClipboardStore((s) => s.selectEntry);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [shortcutModifierPressed, setShortcutModifierPressed] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ startIndex: 0, endIndex: 0 });
  const shortcutModifierKey = platform === "macos" ? "Meta" : "Control";

  const displayEntries = showFavoritesOnly
    ? entries.filter((entry) => entry.is_favorite)
    : entries;

  const shortcutTargets = useMemo(() => {
    if (!shortcutModifierPressed || displayEntries.length === 0) {
      return new Map<number, string>();
    }

    const maxIndex = Math.min(
      visibleRange.endIndex,
      displayEntries.length - 1,
      visibleRange.startIndex + 8
    );
    const mappings = new Map<number, string>();
    for (let index = visibleRange.startIndex; index <= maxIndex; index++) {
      mappings.set(index - visibleRange.startIndex + 1, displayEntries[index].id);
    }
    return mappings;
  }, [displayEntries, shortcutModifierPressed, visibleRange.endIndex, visibleRange.startIndex]);

  const shortcutNumbersByEntryId = useMemo(() => {
    const mappings = new Map<string, number>();
    shortcutTargets.forEach((entryId, shortcutNumber) => {
      mappings.set(entryId, shortcutNumber);
    });
    return mappings;
  }, [shortcutTargets]);

  const hasActiveFilters = Boolean(
    keyword.trim() || showFavoritesOnly || showTagPanel || typeFilter
  );

  const isEditableTarget = (target: EventTarget | null) => {
    const element = target as HTMLElement | null;
    if (!element) return false;
    return (
      element.tagName === "INPUT" ||
      element.tagName === "TEXTAREA" ||
      element.isContentEditable
    );
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (displayEntries.length === 0) return;
      if (e.key === shortcutModifierKey) {
        setShortcutModifierPressed(true);
        return;
      }

      if ((platform === "macos" ? e.metaKey : e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        const shortcutNumber = Number(e.key);
        const entryId = shortcutTargets.get(shortcutNumber);
        if (!entryId) {
          return;
        }

        e.preventDefault();
        setShortcutModifierPressed(false);
        pasteEntry(entryId)
          .then(() => toast.success(t("toast.pasted")))
          .catch(() => toast.error(t("toast.pasteFailed")));
        return;
      }

      if (
        isEditableTarget(e.target) &&
        e.key !== "ArrowDown" &&
        e.key !== "ArrowUp" &&
        e.key !== "Enter"
      ) {
        return;
      }

      const idx = selectedId ? displayEntries.findIndex((entry) => entry.id === selectedId) : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (isEditableTarget(e.target)) (e.target as HTMLElement).blur();
        const next = Math.min(idx + 1, displayEntries.length - 1);
        selectEntry(displayEntries[next].id);
        virtuosoRef.current?.scrollIntoView({ index: next, behavior: "auto" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (isEditableTarget(e.target)) (e.target as HTMLElement).blur();
        const prev = Math.max(idx - 1, 0);
        selectEntry(displayEntries[prev].id);
        virtuosoRef.current?.scrollIntoView({ index: prev, behavior: "auto" });
      } else if (e.key === "Enter" && selectedId) {
        e.preventDefault();
        pasteEntry(selectedId)
          .then(() => toast.success(t("toast.pasted")))
          .catch(() => toast.error(t("toast.pasteFailed")));
      } else if (e.key === " " && selectedId) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        const entry = displayEntries.find((en) => en.id === selectedId);
        if (!entry) return;
        if (entry.content_type === "Image" && entry.blob_path) {
          openImageViewer(entry.blob_path);
        } else if (entry.content_type === "FilePaths") {
          openFileViewer(entry.id);
        } else if (entry.text_content && /^https?:\/\/\S+$/i.test(entry.text_content.trim())) {
          openUrl(entry.text_content.trim()).catch(() => toast.error(t("toast.openUrlFailed")));
        } else {
          openDetailWindow(entry.id, "view");
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === shortcutModifierKey) {
        setShortcutModifierPressed(false);
      }
    };

    const handleWindowBlur = () => {
      setShortcutModifierPressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [displayEntries, platform, selectedId, selectEntry, shortcutModifierKey, shortcutTargets, t]);

  useEffect(() => {
    if (!selectedId && displayEntries.length > 0) {
      selectEntry(displayEntries[0].id);
      virtuosoRef.current?.scrollToIndex({ index: 0, behavior: "auto" });
    }
  }, [displayEntries, selectedId, selectEntry]);

  return (
    <div className="app-shell flex h-full flex-col">
      {/* Header: search + buttons */}
      <div className="flex items-center gap-1.5 px-2 pb-1.5 pt-1">
        <SearchBar />
        <div className="relative shrink-0">
          <button
            onClick={() => setShowTemplatePicker((value) => !value)}
            className="header-action-btn shrink-0"
            title={t("template.title")}
            aria-label={t("template.title")}
          >
            <FileText className="h-[15px] w-[15px]" />
          </button>
          {showTemplatePicker && (
            <TemplateQuickPicker onClose={() => setShowTemplatePicker(false)} />
          )}
        </div>
        <button
          onClick={onOpenSettings}
          className="header-action-btn shrink-0"
          title={t("settings.title")}
          aria-label={t("settings.title")}
        >
          <Settings className="h-[15px] w-[15px]" />
        </button>
      </div>

      {/* Filter tabs */}
      <TypeFilter />

      {/* Entry list */}
      <div className="relative flex-1 min-h-0">
        {loading && (
          <div className="pointer-events-none absolute right-3 top-2 z-10 flex items-center gap-2 rounded-full border border-border/60 bg-card/90 px-2.5 py-1 text-2xs font-medium text-muted-foreground shadow-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{t("clipboardPanel.loading")}</span>
          </div>
        )}

        {displayEntries.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-muted-foreground/70">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
              <ClipboardList className="h-7 w-7 text-muted-foreground/55" />
            </div>
            <div className="text-center">
              <p className="text-sm2 font-medium text-foreground">
                {hasActiveFilters
                  ? t("clipboardPanel.emptyFiltered")
                  : t("clipboardPanel.noEntries")}
              </p>
              <p className="mt-1 text-xs2">
                {hasActiveFilters
                  ? t("clipboardPanel.emptyFilteredHint")
                  : t("clipboardPanel.copyToStart")}
              </p>
            </div>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={displayEntries}
            rangeChanged={(range) => {
              setVisibleRange({ startIndex: range.startIndex, endIndex: range.endIndex });
            }}
            itemContent={(index, entry) => (
              <div
                className={cn(
                  "px-2",
                  index === 0 ? "pt-0.5" : "",
                  index === displayEntries.length - 1 ? "pb-3" : "border-b border-border/20"
                )}
              >
                <EntryCard
                  entry={entry}
                  shortcutNumber={
                    shortcutModifierPressed
                      ? shortcutNumbersByEntryId.get(entry.id) ?? null
                      : null
                  }
                />
              </div>
            )}
            overscan={100}
            className="h-full"
          />
        )}
      </div>

      {/* Status bar */}
      <div className="status-bar-panel flex shrink-0 items-center justify-between px-2.5 py-1.5 text-xs2 text-muted-foreground/80">
        <span>{t("clipboardPanel.items", { count: totalCount })}</span>
        <div className="flex items-center gap-1.5">
          <kbd className="status-kbd">↑↓</kbd>
          <span>{t("clipboardPanel.statusSelect")}</span>
          <span className="text-border">·</span>
          <kbd className="status-kbd">←→</kbd>
          <span>{t("clipboardPanel.statusToggle")}</span>
          <span className="text-border">·</span>
          <kbd className="status-kbd">↵</kbd>
          <span>{t("clipboardPanel.statusPaste")}</span>
          <span className="text-border">·</span>
          <kbd className="status-kbd">␣</kbd>
          <span>{t("clipboardPanel.statusPreview")}</span>
        </div>
      </div>
    </div>
  );
}
