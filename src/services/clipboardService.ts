import { invoke } from "@tauri-apps/api/core";
import type { ClipboardEntry, HistoryQuery, ClipboardStats } from "@/types";

export async function getClipboardHistory(
  query: HistoryQuery = {}
): Promise<ClipboardEntry[]> {
  return invoke("get_clipboard_history", {
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
    typeFilter: query.type_filter ?? null,
    keyword: query.keyword ?? null,
    tagFilter: query.tag_filter ?? null,
  });
}

export async function getEntry(
  id: string
): Promise<ClipboardEntry | null> {
  return invoke("get_entry", { id });
}

export async function deleteEntries(ids: string[]): Promise<void> {
  return invoke("delete_entries", { ids });
}

export async function toggleFavorite(id: string): Promise<boolean> {
  return invoke("toggle_favorite", { id });
}

export async function togglePin(id: string): Promise<boolean> {
  return invoke("toggle_pin", { id });
}

export async function clearHistory(keepFavorites: boolean): Promise<void> {
  return invoke("clear_history", { keepFavorites });
}

export async function pasteEntry(
  id: string,
  mode?: string
): Promise<void> {
  return invoke("paste_entry", { id, mode: mode ?? null });
}

export async function exportData(): Promise<string> {
  return invoke("export_data");
}

export async function importData(jsonData: string): Promise<number> {
  return invoke("import_data", { jsonData });
}

export async function getEntryCount(): Promise<number> {
  return invoke("get_entry_count");
}

export async function addTag(entryId: string, tag: string): Promise<void> {
  return invoke("add_tag", { entryId, tag });
}

export async function removeTag(entryId: string, tag: string): Promise<void> {
  return invoke("remove_tag", { entryId, tag });
}

export async function getAllTags(): Promise<string[]> {
  return invoke("get_all_tags");
}

export async function getClipboardStats(): Promise<ClipboardStats> {
  return invoke("get_clipboard_stats");
}

export interface CacheInfo {
  cache_dir: string;
  total_size_bytes: number;
  file_count: number;
  blob_count: number;
  thumbnail_count: number;
}

export async function getThumbnailBase64(relativePath: string): Promise<string> {
  return invoke("get_thumbnail_base64", { relativePath });
}

export async function extractTextFromImage(relativePath: string): Promise<string> {
  return invoke("extract_text_from_image", { relativePath });
}

export async function getCacheInfo(): Promise<CacheInfo> {
  return invoke("get_cache_info");
}

export async function cleanupCache(): Promise<number> {
  return invoke("cleanup_cache");
}

export async function setCacheDir(newPath: string): Promise<void> {
  return invoke("set_cache_dir", { newPath });
}

export async function migrateCache(newPath: string): Promise<{ files_copied: number; bytes_copied: number }> {
  return invoke("migrate_cache", { newPath });
}

export async function setCacheMaxSize(maxSizeMb: number): Promise<void> {
  return invoke("set_cache_max_size", { maxSizeMb });
}

export async function getCacheMaxSize(): Promise<number> {
  return invoke("get_cache_max_size");
}

export async function cleanupCacheBySize(): Promise<number> {
  return invoke("cleanup_cache_by_size");
}
