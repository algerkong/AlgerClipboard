export type ContentType = "PlainText" | "RichText" | "Image" | "FilePaths";
export type SyncStatus = "Local" | "Synced" | "PendingSync" | "Conflict";

export interface ClipboardEntry {
  id: string;
  content_type: ContentType;
  text_content: string | null;
  html_content: string | null;
  blob_path: string | null;
  thumbnail_path: string | null;
  content_hash: string;
  source_app: string | null;
  source_url: string | null;
  source_icon: string | null;
  device_id: string;
  is_favorite: boolean;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  sync_status: SyncStatus;
  sync_version: number;
  ai_summary: string | null;
  content_category: string | null;
  detected_language: string | null;
  file_meta: string | null;
  ocr_text: string | null;
}

export interface HistoryQuery {
  limit?: number;
  offset?: number;
  type_filter?: ContentType;
  keyword?: string;
  tag_filter?: string;
  tagged_only?: boolean;
  time_range?: TimeRange;
}

export interface SearchHistoryItem {
  id: number;
  keyword: string;
  search_count: number;
  last_used_at: string;
}

export type TimeRange = "all" | "today" | "3days" | "week" | "month" | "3months";

export interface TranslateResult {
  text: string;
  translated: string;
  from_lang: string;
  to_lang: string;
  engine: string;
}

export type TranslateEngineName = "baidu" | "youdao" | "google";

export interface TranslateEngineConfig {
  engine: string;
  api_key: string;
  api_secret: string;
  enabled: boolean;
}

export interface SyncAccount {
  id: string;
  provider: "webdav" | "google_drive" | "onedrive";
  config: string;
  sync_frequency: "realtime" | "interval" | "manual";
  interval_minutes: number | null;
  encryption_enabled: boolean;
  last_sync_at: string | null;
  last_sync_version: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncResult {
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
  settings_pushed?: number;
  settings_pulled?: number;
  latest_pulled_entry_id?: string;
}

export interface TypeCount {
  content_type: string;
  count: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface ClipboardStats {
  total: number;
  favorites: number;
  pinned: number;
  type_counts: TypeCount[];
  daily_trend: DailyCount[];
}

export interface TagSummary {
  tag: string;
  count: number;
}

export interface OcrTextLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrResult {
  lines: OcrTextLine[];
  image_width: number;
  image_height: number;
}

export type FileType = "Image" | "Video" | "Audio" | "Document" | "Archive" | "Code" | "Executable" | "Font" | "Data" | "Other";

export interface FileMeta {
  path: string;
  name: string;
  extension: string | null;
  size: number;
  is_dir: boolean;
  modified: number | null;
  file_type: FileType;
  child_count: number | null;
}

export interface FilePreview {
  content: string;
  size: number;
  truncated: boolean;
}

export interface DirTreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  children: DirTreeNode[] | null;
}

export interface ArchiveEntry {
  name: string;
  size: number;
  compressed_size: number;
  is_dir: boolean;
}

export interface Template {
  id: string;
  title: string;
  content: string;
  group_name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
