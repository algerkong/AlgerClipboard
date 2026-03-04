import { useEffect, useRef } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";
import { Settings } from "lucide-react";
import { SearchBar } from "@/components/SearchBar";
import { TypeFilter } from "@/components/TypeFilter";
import { EntryCard } from "@/components/EntryCard";
import { useClipboardStore } from "@/stores/clipboardStore";
import { pasteEntry } from "@/services/clipboardService";

interface Props {
  onOpenSettings: () => void;
}

export function ClipboardPanel({ onOpenSettings }: Props) {
  const entries = useClipboardStore((s) => s.entries);
  const showFavoritesOnly = useClipboardStore((s) => s.showFavoritesOnly);
  const selectedId = useClipboardStore((s) => s.selectedId);
  const selectEntry = useClipboardStore((s) => s.selectEntry);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const displayEntries = showFavoritesOnly
    ? entries.filter((e) => e.is_favorite)
    : entries;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (displayEntries.length === 0) return;
      // Don't interfere with typing in search
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" && e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;

      const idx = selectedId ? displayEntries.findIndex((x) => x.id === selectedId) : -1;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(idx + 1, displayEntries.length - 1);
        selectEntry(displayEntries[next].id);
        virtuosoRef.current?.scrollIntoView({ index: next, behavior: "auto" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(idx - 1, 0);
        selectEntry(displayEntries[prev].id);
        virtuosoRef.current?.scrollIntoView({ index: prev, behavior: "auto" });
      } else if (e.key === "Enter" && selectedId) {
        e.preventDefault();
        pasteEntry(selectedId).catch(console.error);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayEntries, selectedId, selectEntry]);

  // Auto-select first entry
  useEffect(() => {
    if (!selectedId && displayEntries.length > 0) {
      selectEntry(displayEntries[0].id);
    }
  }, [displayEntries, selectedId, selectEntry]);

  return (
    <div className="flex flex-col h-full">
      {/* Header: Search + Settings */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/30">
        <SearchBar />
        <button
          onClick={onOpenSettings}
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent/50 transition-colors shrink-0"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Type filter tabs */}
      <TypeFilter />

      {/* Entry list */}
      <div className="flex-1 min-h-0">
        {displayEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/40">
            <p className="text-xs">No clipboard entries yet</p>
            <p className="text-[10px]">Copy something to get started</p>
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={displayEntries}
            itemContent={(_, entry) => <EntryCard entry={entry} />}
            overscan={100}
            className="h-full"
          />
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 text-[10px] text-muted-foreground/40 border-t border-border/20 shrink-0">
        <span>{displayEntries.length} items</span>
        <span>&#8629; paste &middot; esc close</span>
      </div>
    </div>
  );
}
