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
  device_id: string;
  is_favorite: boolean;
  is_pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  sync_status: SyncStatus;
  sync_version: number;
}

export interface HistoryQuery {
  limit?: number;
  offset?: number;
  type_filter?: ContentType;
  keyword?: string;
}

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
