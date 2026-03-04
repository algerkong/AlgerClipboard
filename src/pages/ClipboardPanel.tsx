import { useEffect, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SearchBar } from "@/components/SearchBar";
import { TypeFilter } from "@/components/TypeFilter";
import { EntryCard } from "@/components/EntryCard";
import { useClipboardStore } from "@/stores/clipboardStore";
import { pasteEntry } from "@/services/clipboardService";

interface ClipboardPanelProps {
  onOpenSettings: () => void;
}

export function ClipboardPanel({ onOpenSettings }: ClipboardPanelProps) {
  const entries = useClipboardStore((s) => s.entries);
  const showFavoritesOnly = useClipboardStore((s) => s.showFavoritesOnly);
  const selectedId = useClipboardStore((s) => s.selectedId);
  const selectEntry = useClipboardStore((s) => s.selectEntry);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const displayEntries = showFavoritesOnly
    ? entries.filter((e) => e.is_favorite)
    : entries;

  // Global keyboard handler for arrow navigation and Enter to paste
  // Uses window-level listener so it works even when search input is focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (displayEntries.length === 0) return;

      const currentIndex = selectedId
        ? displayEntries.findIndex((entry) => entry.id === selectedId)
        : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = Math.min(currentIndex + 1, displayEntries.length - 1);
        const nextEntry = displayEntries[nextIndex];
        if (nextEntry) {
          selectEntry(nextEntry.id);
          virtuosoRef.current?.scrollIntoView({
            index: nextIndex,
            behavior: "smooth",
          });
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = Math.max(currentIndex - 1, 0);
        const prevEntry = displayEntries[prevIndex];
        if (prevEntry) {
          selectEntry(prevEntry.id);
          virtuosoRef.current?.scrollIntoView({
            index: prevIndex,
            behavior: "smooth",
          });
        }
      } else if (e.key === "Enter" && selectedId) {
        e.preventDefault();
        pasteEntry(selectedId).catch((err) =>
          console.error("Failed to paste:", err)
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayEntries, selectedId, selectEntry]);

  // Auto-select first entry when entries change and nothing is selected
  useEffect(() => {
    if (!selectedId && displayEntries.length > 0) {
      selectEntry(displayEntries[0].id);
    }
  }, [displayEntries, selectedId, selectEntry]);

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center gap-2 p-2 shrink-0">
          <div className="flex-1">
            <SearchBar />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenSettings}
            title="Settings"
          >
            <Settings className="size-4" />
          </Button>
        </div>
        <Separator />

        {/* Content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-[100px] shrink-0 border-r border-border">
            <TypeFilter />
          </div>

          {/* Entry list */}
          <div className="flex-1 min-w-0">
            {displayEntries.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No clipboard entries
              </div>
            ) : (
              <Virtuoso
                ref={virtuosoRef}
                data={displayEntries}
                itemContent={(_index, entry) => (
                  <EntryCard entry={entry} />
                )}
                overscan={200}
                className="h-full"
              />
            )}
          </div>
        </div>

        {/* Status bar */}
        <Separator />
        <div className="flex items-center justify-between px-3 py-1 text-xs text-muted-foreground shrink-0">
          <span>
            {displayEntries.length} item
            {displayEntries.length !== 1 ? "s" : ""}
          </span>
          <span className="text-[10px]">
            Press Enter to paste, Esc to close
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
