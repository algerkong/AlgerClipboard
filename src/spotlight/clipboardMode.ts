import type { SpotlightMode, SpotlightResult } from "./types";
import { searchEntries, pasteEntry } from "@/services/clipboardService";
import { invoke } from "@tauri-apps/api/core";
import { getSetting } from "@/services/settingsService";
import type { ClipboardEntry } from "@/types";

function entryToResult(entry: ClipboardEntry): SpotlightResult {
  const isImage = entry.content_type === "Image";
  const isFile = entry.content_type === "FilePaths";

  let title = "";
  if (isImage) {
    title = "Image";
  } else if (isFile) {
    try {
      const meta = entry.file_meta ? JSON.parse(entry.file_meta) : null;
      title = meta?.files?.[0]?.name ?? "File";
    } catch {
      title = entry.text_content?.split("\n")[0] ?? "File";
    }
  } else {
    title = (entry.text_content ?? "").split("\n")[0].slice(0, 100);
  }

  let icon: SpotlightResult["icon"];
  if (isImage && entry.thumbnail_path) {
    icon = { type: "thumbnail", data: entry.thumbnail_path };
  }

  const badge = entry.content_type === "PlainText"
    ? "Text"
    : entry.content_type === "RichText"
      ? "Rich"
      : entry.content_type;

  const timeAgo = formatTimeAgo(entry.created_at);
  const subtitle = [entry.source_app, timeAgo].filter(Boolean).join(" · ");

  return {
    id: entry.id,
    title,
    subtitle,
    icon,
    badge,
  };
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}d ago`;
}

export const clipboardMode: SpotlightMode = {
  id: "clipboard",
  name: "spotlight.mode.clipboard",
  icon: "lucide:clipboard-list",
  placeholder: "spotlight.placeholder.clipboard",
  shortcutSettingKey: "spotlight_clipboard_shortcut",
  debounceMs: 200,

  onQuery: async (query: string): Promise<SpotlightResult[]> => {
    if (!query.trim()) {
      return [];
    }

    const entries = await searchEntries(query, { limit: 8 });
    return entries.map(entryToResult);
  },

  onSelect: async (result: SpotlightResult): Promise<void> => {
    const behavior = (await getSetting("spotlight_enter_behavior")) ?? "paste";
    if (behavior === "paste") {
      await pasteEntry(result.id);
    } else {
      // Copy only: write to clipboard without simulating paste
      await invoke("paste_entry", { id: result.id, mode: "copy" });
    }
  },
};
