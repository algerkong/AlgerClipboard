# M1 MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the MVP of AlgerClipboard — a cross-platform clipboard manager with history, global hotkey, smart paste, favorites, and local storage.

**Architecture:** Tauri 2 desktop app with Rust backend (clipboard monitoring, SQLite storage, hotkey management, paste simulation) and React+TypeScript frontend (clipboard panel, search, settings). Communication via Tauri IPC Commands and Events.

**Tech Stack:** Tauri 2, React 18, TypeScript 5, Zustand, Shadcn/ui, Tailwind CSS, SQLite (rusqlite), arboard, Vite, pnpm

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`
- Create: `src/main.tsx`, `src/App.tsx`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `index.html`

**Step 1: Initialize Tauri 2 + React + TypeScript project**

```bash
cd E:/project/AlgerClipboard
pnpm create tauri-app . --template react-ts --manager pnpm --yes
```

If the interactive prompt doesn't support `--yes`, use:
```bash
pnpm create tauri-app alger-clipboard-temp --template react-ts --manager pnpm
# Then move files from alger-clipboard-temp/ to current dir
```

**Step 2: Install frontend dependencies**

```bash
pnpm add zustand react-virtuoso lucide-react sonner
pnpm add -D tailwindcss @tailwindcss/vite
```

**Step 3: Install Shadcn/ui**

```bash
pnpm dlx shadcn@latest init -d
```

**Step 4: Add Shadcn components we need**

```bash
pnpm dlx shadcn@latest add button input scroll-area dialog dropdown-menu tabs tooltip badge separator
```

**Step 5: Install Tauri plugins**

```bash
cd src-tauri
cargo add tauri-plugin-global-shortcut tauri-plugin-shell tauri-plugin-notification
cd ..
```

**Step 6: Add Rust dependencies to `src-tauri/Cargo.toml`**

Append to `[dependencies]`:
```toml
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
sha2 = "0.10"
arboard = { version = "3", features = ["image-data"] }
chrono = { version = "0.4", features = ["serde"] }
image = "0.25"
tokio = { version = "1", features = ["full"] }
log = "0.4"
env_logger = "0.11"
hex = "0.4"
directories = "5"
```

**Step 7: Verify build**

```bash
pnpm tauri dev
```

Expected: Tauri window opens with default React page. Close it.

**Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Tauri 2 + React + TypeScript project"
```

---

### Task 2: Rust Data Models & SQLite Storage

**Files:**
- Create: `src-tauri/src/storage/mod.rs`
- Create: `src-tauri/src/storage/database.rs`
- Create: `src-tauri/src/storage/blob.rs`
- Create: `src-tauri/src/clipboard/mod.rs`
- Create: `src-tauri/src/clipboard/entry.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Create clipboard entry data model**

Create `src-tauri/src/clipboard/entry.rs`:

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ContentType {
    PlainText,
    RichText,
    Image,
    FilePaths,
}

impl ContentType {
    pub fn as_str(&self) -> &str {
        match self {
            ContentType::PlainText => "PlainText",
            ContentType::RichText => "RichText",
            ContentType::Image => "Image",
            ContentType::FilePaths => "FilePaths",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "PlainText" => Some(ContentType::PlainText),
            "RichText" => Some(ContentType::RichText),
            "Image" => Some(ContentType::Image),
            "FilePaths" => Some(ContentType::FilePaths),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncStatus {
    Local,
    Synced,
    PendingSync,
    Conflict,
}

impl SyncStatus {
    pub fn as_str(&self) -> &str {
        match self {
            SyncStatus::Local => "local",
            SyncStatus::Synced => "synced",
            SyncStatus::PendingSync => "pending",
            SyncStatus::Conflict => "conflict",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "synced" => SyncStatus::Synced,
            "pending" => SyncStatus::PendingSync,
            "conflict" => SyncStatus::Conflict,
            _ => SyncStatus::Local,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardEntry {
    pub id: String,
    pub content_type: ContentType,
    pub text_content: Option<String>,
    pub html_content: Option<String>,
    pub blob_path: Option<String>,
    pub thumbnail_path: Option<String>,
    pub content_hash: String,
    pub source_app: Option<String>,
    pub device_id: String,
    pub is_favorite: bool,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub synced_at: Option<String>,
    pub sync_status: SyncStatus,
}

impl ClipboardEntry {
    pub fn new_text(text: String, device_id: String) -> Self {
        let now = Utc::now().to_rfc3339();
        let hash = crate::storage::database::compute_hash(text.as_bytes());
        Self {
            id: Uuid::new_v4().to_string(),
            content_type: ContentType::PlainText,
            text_content: Some(text),
            html_content: None,
            blob_path: None,
            thumbnail_path: None,
            content_hash: hash,
            source_app: None,
            device_id,
            is_favorite: false,
            tags: vec![],
            created_at: now.clone(),
            updated_at: now,
            synced_at: None,
            sync_status: SyncStatus::Local,
        }
    }
}
```

Create `src-tauri/src/clipboard/mod.rs`:
```rust
pub mod entry;
```

**Step 2: Create SQLite database module**

Create `src-tauri/src/storage/database.rs`:

```rust
use crate::clipboard::entry::{ClipboardEntry, ContentType, SyncStatus};
use rusqlite::{params, Connection, Result as SqlResult};
use sha2::{Digest, Sha256};
use std::path::Path;
use std::sync::Mutex;

pub struct Database {
    conn: Mutex<Connection>,
}

pub fn compute_hash(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

impl Database {
    pub fn new(db_path: &Path) -> SqlResult<Self> {
        let conn = Connection::open(db_path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS entries (
                id              TEXT PRIMARY KEY,
                content_type    TEXT NOT NULL,
                text_content    TEXT,
                html_content    TEXT,
                blob_path       TEXT,
                thumbnail_path  TEXT,
                content_hash    TEXT NOT NULL,
                source_app      TEXT,
                device_id       TEXT NOT NULL,
                is_favorite     INTEGER DEFAULT 0,
                created_at      TEXT NOT NULL,
                updated_at      TEXT NOT NULL,
                synced_at       TEXT,
                sync_status     TEXT DEFAULT 'local',
                deleted         INTEGER DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_entries_hash ON entries(content_hash);
            CREATE INDEX IF NOT EXISTS idx_entries_created ON entries(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(content_type);
            CREATE INDEX IF NOT EXISTS idx_entries_favorite ON entries(is_favorite);

            CREATE TABLE IF NOT EXISTS tags (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id    TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
                tag         TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tags_entry ON tags(entry_id);
            CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(tag);

            CREATE TABLE IF NOT EXISTS templates (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL,
                content     TEXT NOT NULL,
                group_name  TEXT DEFAULT 'default',
                sort_order  INTEGER DEFAULT 0,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key         TEXT PRIMARY KEY,
                value       TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );
            "
        )?;
        Ok(())
    }

    pub fn insert_entry(&self, entry: &ClipboardEntry) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO entries (id, content_type, text_content, html_content, blob_path, thumbnail_path, content_hash, source_app, device_id, is_favorite, created_at, updated_at, synced_at, sync_status)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                entry.id,
                entry.content_type.as_str(),
                entry.text_content,
                entry.html_content,
                entry.blob_path,
                entry.thumbnail_path,
                entry.content_hash,
                entry.source_app,
                entry.device_id,
                entry.is_favorite as i32,
                entry.created_at,
                entry.updated_at,
                entry.synced_at,
                entry.sync_status.as_str(),
            ],
        )?;

        // Insert tags
        let entry_id = &entry.id;
        conn.execute("DELETE FROM tags WHERE entry_id = ?1", params![entry_id])?;
        for tag in &entry.tags {
            conn.execute(
                "INSERT INTO tags (entry_id, tag) VALUES (?1, ?2)",
                params![entry_id, tag],
            )?;
        }
        Ok(())
    }

    pub fn find_by_hash(&self, hash: &str) -> SqlResult<Option<ClipboardEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT * FROM entries WHERE content_hash = ?1 AND deleted = 0 LIMIT 1"
        )?;
        let mut rows = stmt.query_mapped(params![hash], |row| self.row_to_entry(row))?;
        match rows.next() {
            Some(Ok(entry)) => Ok(Some(entry)),
            _ => Ok(None),
        }
    }

    pub fn get_history(
        &self,
        limit: i64,
        offset: i64,
        type_filter: Option<&str>,
        keyword: Option<&str>,
    ) -> SqlResult<Vec<ClipboardEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut sql = String::from(
            "SELECT * FROM entries WHERE deleted = 0"
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

        if let Some(t) = type_filter {
            sql.push_str(&format!(" AND content_type = ?{}", param_values.len() + 1));
            param_values.push(Box::new(t.to_string()));
        }

        if let Some(kw) = keyword {
            sql.push_str(&format!(" AND text_content LIKE ?{}", param_values.len() + 1));
            param_values.push(Box::new(format!("%{}%", kw)));
        }

        sql.push_str(&format!(" ORDER BY created_at DESC LIMIT ?{} OFFSET ?{}", param_values.len() + 1, param_values.len() + 2));
        param_values.push(Box::new(limit));
        param_values.push(Box::new(offset));

        let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

        let mut stmt = conn.prepare(&sql)?;
        let entries = stmt
            .query_map(params_ref.as_slice(), |row| self.row_to_entry(row))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(entries)
    }

    pub fn get_entry(&self, id: &str) -> SqlResult<Option<ClipboardEntry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM entries WHERE id = ?1 AND deleted = 0")?;
        let mut rows = stmt.query_mapped(params![id], |row| self.row_to_entry(row))?;
        match rows.next() {
            Some(Ok(entry)) => Ok(Some(entry)),
            _ => Ok(None),
        }
    }

    pub fn delete_entries(&self, ids: &[String]) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        for id in ids {
            conn.execute(
                "UPDATE entries SET deleted = 1 WHERE id = ?1",
                params![id],
            )?;
        }
        Ok(())
    }

    pub fn toggle_favorite(&self, id: &str) -> SqlResult<bool> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE entries SET is_favorite = CASE WHEN is_favorite = 0 THEN 1 ELSE 0 END, updated_at = datetime('now') WHERE id = ?1",
            params![id],
        )?;
        let is_fav: bool = conn.query_row(
            "SELECT is_favorite FROM entries WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?;
        Ok(is_fav)
    }

    pub fn update_entry_timestamp(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE entries SET created_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn cleanup_old_entries(&self, max_count: i64) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "DELETE FROM entries WHERE id IN (
                SELECT id FROM entries WHERE is_favorite = 0 AND deleted = 0
                ORDER BY created_at DESC LIMIT -1 OFFSET ?1
            )",
            params![max_count],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> SqlResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query_map(params![key], |row| row.get::<_, String>(0))?;
        match rows.next() {
            Some(Ok(v)) => Ok(Some(v)),
            _ => Ok(None),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
            params![key, value, now],
        )?;
        Ok(())
    }

    fn row_to_entry(&self, row: &rusqlite::Row) -> rusqlite::Result<ClipboardEntry> {
        let is_fav_int: i32 = row.get("is_favorite")?;
        let content_type_str: String = row.get("content_type")?;
        let sync_status_str: String = row.get("sync_status")?;
        Ok(ClipboardEntry {
            id: row.get("id")?,
            content_type: ContentType::from_str(&content_type_str).unwrap_or(ContentType::PlainText),
            text_content: row.get("text_content")?,
            html_content: row.get("html_content")?,
            blob_path: row.get("blob_path")?,
            thumbnail_path: row.get("thumbnail_path")?,
            content_hash: row.get("content_hash")?,
            source_app: row.get("source_app")?,
            device_id: row.get("device_id")?,
            is_favorite: is_fav_int != 0,
            tags: vec![], // Tags loaded separately when needed
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            synced_at: row.get("synced_at")?,
            sync_status: SyncStatus::from_str(&sync_status_str),
        })
    }
}
```

Create `src-tauri/src/storage/blob.rs`:

```rust
use std::fs;
use std::path::{Path, PathBuf};

pub struct BlobStore {
    base_dir: PathBuf,
}

impl BlobStore {
    pub fn new(base_dir: &Path) -> std::io::Result<Self> {
        let blobs_dir = base_dir.join("blobs");
        let thumbs_dir = base_dir.join("thumbnails");
        fs::create_dir_all(&blobs_dir)?;
        fs::create_dir_all(&thumbs_dir)?;
        Ok(Self {
            base_dir: base_dir.to_path_buf(),
        })
    }

    pub fn save_blob(&self, id: &str, data: &[u8], ext: &str) -> std::io::Result<String> {
        let filename = format!("{}.{}", id, ext);
        let path = self.base_dir.join("blobs").join(&filename);
        fs::write(&path, data)?;
        Ok(format!("blobs/{}", filename))
    }

    pub fn save_thumbnail(&self, id: &str, data: &[u8]) -> std::io::Result<String> {
        let filename = format!("{}.png", id);
        let path = self.base_dir.join("thumbnails").join(&filename);
        fs::write(&path, data)?;
        Ok(format!("thumbnails/{}", filename))
    }

    pub fn get_blob_path(&self, relative_path: &str) -> PathBuf {
        self.base_dir.join(relative_path)
    }

    pub fn delete_blob(&self, relative_path: &str) -> std::io::Result<()> {
        let path = self.base_dir.join(relative_path);
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }
}
```

Create `src-tauri/src/storage/mod.rs`:
```rust
pub mod blob;
pub mod database;
```

**Step 3: Wire up modules in lib.rs**

Update `src-tauri/src/lib.rs` to declare modules:
```rust
mod clipboard;
mod storage;

pub use storage::database::Database;
pub use storage::blob::BlobStore;
```

**Step 4: Verify build**

```bash
cd E:/project/AlgerClipboard
pnpm tauri build --debug 2>&1 | head -20
# Or just: cd src-tauri && cargo check
```

Expected: Compiles without errors.

**Step 5: Commit**

```bash
git add src-tauri/src/clipboard/ src-tauri/src/storage/ src-tauri/src/lib.rs src-tauri/Cargo.toml
git commit -m "feat: add clipboard entry data model and SQLite storage layer"
```

---

### Task 3: Clipboard Monitor (Rust Backend)

**Files:**
- Create: `src-tauri/src/clipboard/monitor.rs`
- Create: `src-tauri/src/clipboard/dedup.rs`
- Modify: `src-tauri/src/clipboard/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Create dedup module**

Create `src-tauri/src/clipboard/dedup.rs`:
```rust
use crate::storage::database::Database;

/// Returns Some(existing_entry_id) if content with this hash exists, None otherwise.
pub fn check_duplicate(db: &Database, hash: &str) -> Option<String> {
    match db.find_by_hash(hash) {
        Ok(Some(entry)) => Some(entry.id),
        _ => None,
    }
}
```

**Step 2: Create clipboard monitor**

Create `src-tauri/src/clipboard/monitor.rs`:

```rust
use crate::clipboard::dedup::check_duplicate;
use crate::clipboard::entry::{ClipboardEntry, ContentType};
use crate::storage::blob::BlobStore;
use crate::storage::database::{compute_hash, Database};
use arboard::Clipboard;
use chrono::Utc;
use image::GenericImageView;
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};
use std::time::Duration;
use uuid::Uuid;

pub struct ClipboardMonitor {
    running: Arc<AtomicBool>,
    device_id: String,
}

impl ClipboardMonitor {
    pub fn new(device_id: String) -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            device_id,
        }
    }

    pub fn start<F>(
        &self,
        db: Arc<Database>,
        blob_store: Arc<BlobStore>,
        on_change: F,
    ) where
        F: Fn(ClipboardEntry) + Send + 'static,
    {
        self.running.store(true, Ordering::SeqCst);
        let running = self.running.clone();
        let device_id = self.device_id.clone();

        std::thread::spawn(move || {
            let mut clipboard = match Clipboard::new() {
                Ok(c) => c,
                Err(e) => {
                    log::error!("Failed to create clipboard: {}", e);
                    return;
                }
            };

            let mut last_hash = String::new();

            while running.load(Ordering::SeqCst) {
                // Try to read text
                if let Ok(text) = clipboard.get_text() {
                    if !text.is_empty() {
                        let hash = compute_hash(text.as_bytes());
                        if hash != last_hash {
                            last_hash = hash.clone();

                            // Check for duplicate
                            if let Some(existing_id) = check_duplicate(&db, &hash) {
                                let _ = db.update_entry_timestamp(&existing_id);
                                if let Ok(Some(entry)) = db.get_entry(&existing_id) {
                                    on_change(entry);
                                }
                            } else {
                                let mut entry = ClipboardEntry::new_text(text, device_id.clone());
                                entry.content_hash = hash;
                                if let Err(e) = db.insert_entry(&entry) {
                                    log::error!("Failed to insert entry: {}", e);
                                } else {
                                    on_change(entry);
                                }
                            }
                        }
                    }
                }

                // Try to read image
                if let Ok(img_data) = clipboard.get_image() {
                    let raw_bytes: Vec<u8> = img_data.bytes.to_vec();
                    let hash = compute_hash(&raw_bytes);
                    if hash != last_hash {
                        last_hash = hash.clone();

                        if check_duplicate(&db, &hash).is_none() {
                            let id = Uuid::new_v4().to_string();
                            let now = Utc::now().to_rfc3339();

                            // Save as PNG blob
                            if let Ok(dyn_image) = image::RgbaImage::from_raw(
                                img_data.width as u32,
                                img_data.height as u32,
                                raw_bytes,
                            ).map(image::DynamicImage::ImageRgba8) {
                                let mut png_bytes = Vec::new();
                                if dyn_image.write_to(
                                    &mut std::io::Cursor::new(&mut png_bytes),
                                    image::ImageFormat::Png,
                                ).is_ok() {
                                    if let Ok(blob_path) = blob_store.save_blob(&id, &png_bytes, "png") {
                                        // Generate thumbnail
                                        let thumb = dyn_image.thumbnail(200, 200);
                                        let mut thumb_bytes = Vec::new();
                                        let thumb_path = if thumb.write_to(
                                            &mut std::io::Cursor::new(&mut thumb_bytes),
                                            image::ImageFormat::Png,
                                        ).is_ok() {
                                            blob_store.save_thumbnail(&id, &thumb_bytes).ok()
                                        } else {
                                            None
                                        };

                                        let entry = ClipboardEntry {
                                            id: id.clone(),
                                            content_type: ContentType::Image,
                                            text_content: None,
                                            html_content: None,
                                            blob_path: Some(blob_path),
                                            thumbnail_path: thumb_path,
                                            content_hash: hash,
                                            source_app: None,
                                            device_id: device_id.clone(),
                                            is_favorite: false,
                                            tags: vec![],
                                            created_at: now.clone(),
                                            updated_at: now,
                                            synced_at: None,
                                            sync_status: crate::clipboard::entry::SyncStatus::Local,
                                        };

                                        if let Err(e) = db.insert_entry(&entry) {
                                            log::error!("Failed to insert image entry: {}", e);
                                        } else {
                                            on_change(entry);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                std::thread::sleep(Duration::from_millis(500));
            }
        });
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}
```

**Step 3: Update clipboard/mod.rs**

```rust
pub mod dedup;
pub mod entry;
pub mod monitor;
```

**Step 4: Verify build**

```bash
cd src-tauri && cargo check
```

**Step 5: Commit**

```bash
git add src-tauri/src/clipboard/
git commit -m "feat: add clipboard monitor with text/image support and dedup"
```

---

### Task 4: Tauri IPC Commands (Clipboard)

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/clipboard_cmd.rs`
- Create: `src-tauri/src/commands/settings_cmd.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`

**Step 1: Create clipboard commands**

Create `src-tauri/src/commands/clipboard_cmd.rs`:

```rust
use crate::clipboard::entry::ClipboardEntry;
use crate::storage::database::Database;
use std::sync::Arc;
use tauri::State;

pub struct AppDatabase(pub Arc<Database>);

#[tauri::command]
pub fn get_clipboard_history(
    db: State<'_, AppDatabase>,
    limit: Option<i64>,
    offset: Option<i64>,
    type_filter: Option<String>,
    keyword: Option<String>,
) -> Result<Vec<ClipboardEntry>, String> {
    db.0.get_history(
        limit.unwrap_or(50),
        offset.unwrap_or(0),
        type_filter.as_deref(),
        keyword.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_entry(db: State<'_, AppDatabase>, id: String) -> Result<Option<ClipboardEntry>, String> {
    db.0.get_entry(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_entries(db: State<'_, AppDatabase>, ids: Vec<String>) -> Result<(), String> {
    db.0.delete_entries(&ids).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_favorite(db: State<'_, AppDatabase>, id: String) -> Result<bool, String> {
    db.0.toggle_favorite(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_history(db: State<'_, AppDatabase>, keep_favorites: bool) -> Result<(), String> {
    if keep_favorites {
        db.0.cleanup_old_entries(0).map_err(|e| e.to_string())
    } else {
        // Delete all non-deleted entries
        db.0.cleanup_old_entries(0).map_err(|e| e.to_string())
    }
}
```

Create `src-tauri/src/commands/settings_cmd.rs`:

```rust
use crate::commands::clipboard_cmd::AppDatabase;
use tauri::State;

#[tauri::command]
pub fn get_settings(db: State<'_, AppDatabase>, key: String) -> Result<Option<String>, String> {
    db.0.get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_settings(
    db: State<'_, AppDatabase>,
    key: String,
    value: String,
) -> Result<(), String> {
    db.0.set_setting(&key, &value).map_err(|e| e.to_string())
}
```

Create `src-tauri/src/commands/mod.rs`:
```rust
pub mod clipboard_cmd;
pub mod settings_cmd;
```

**Step 2: Wire everything up in lib.rs**

Replace `src-tauri/src/lib.rs`:

```rust
mod clipboard;
mod commands;
mod storage;

use clipboard::monitor::ClipboardMonitor;
use commands::clipboard_cmd::AppDatabase;
use storage::blob::BlobStore;
use storage::database::Database;
use std::sync::Arc;
use tauri::Manager;

fn get_device_id() -> String {
    let hostname = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    format!("{}-{}", hostname, uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("0000"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");

            // Initialize database
            let db_path = app_data_dir.join("clipboard.db");
            let db = Arc::new(Database::new(&db_path).expect("Failed to initialize database"));
            app.manage(AppDatabase(db.clone()));

            // Initialize blob store
            let blob_store = Arc::new(
                BlobStore::new(&app_data_dir).expect("Failed to initialize blob store"),
            );

            // Get or create device ID
            let device_id = match db.get_setting("device_id") {
                Ok(Some(id)) => id,
                _ => {
                    let id = get_device_id();
                    let _ = db.set_setting("device_id", &id);
                    id
                }
            };

            // Start clipboard monitor
            let monitor = ClipboardMonitor::new(device_id);
            let app_handle = app.handle().clone();
            monitor.start(db.clone(), blob_store, move |entry| {
                let _ = app_handle.emit("clipboard-changed", &entry);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::clipboard_cmd::get_clipboard_history,
            commands::clipboard_cmd::get_entry,
            commands::clipboard_cmd::delete_entries,
            commands::clipboard_cmd::toggle_favorite,
            commands::clipboard_cmd::clear_history,
            commands::settings_cmd::get_settings,
            commands::settings_cmd::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Step 3: Add hostname crate to Cargo.toml**

```bash
cd src-tauri && cargo add hostname
```

**Step 4: Verify build**

```bash
cd src-tauri && cargo check
```

**Step 5: Commit**

```bash
git add src-tauri/
git commit -m "feat: add Tauri IPC commands and app initialization with clipboard monitor"
```

---

### Task 5: TypeScript Types & Service Layer

**Files:**
- Create: `src/types/index.ts`
- Create: `src/services/clipboardService.ts`
- Create: `src/services/settingsService.ts`

**Step 1: Define TypeScript types**

Create `src/types/index.ts`:

```typescript
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
  tags: string[];
  created_at: string;
  updated_at: string;
  synced_at: string | null;
  sync_status: SyncStatus;
}

export interface HistoryQuery {
  limit?: number;
  offset?: number;
  type_filter?: ContentType;
  keyword?: string;
}
```

**Step 2: Create clipboard service**

Create `src/services/clipboardService.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";
import type { ClipboardEntry, HistoryQuery } from "../types";

export async function getClipboardHistory(
  query: HistoryQuery = {}
): Promise<ClipboardEntry[]> {
  return invoke("get_clipboard_history", {
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
    typeFilter: query.type_filter ?? null,
    keyword: query.keyword ?? null,
  });
}

export async function getEntry(id: string): Promise<ClipboardEntry | null> {
  return invoke("get_entry", { id });
}

export async function deleteEntries(ids: string[]): Promise<void> {
  return invoke("delete_entries", { ids });
}

export async function toggleFavorite(id: string): Promise<boolean> {
  return invoke("toggle_favorite", { id });
}

export async function clearHistory(keepFavorites: boolean): Promise<void> {
  return invoke("clear_history", { keepFavorites });
}
```

Create `src/services/settingsService.ts`:

```typescript
import { invoke } from "@tauri-apps/api/core";

export async function getSetting(key: string): Promise<string | null> {
  return invoke("get_settings", { key });
}

export async function updateSetting(
  key: string,
  value: string
): Promise<void> {
  return invoke("update_settings", { key, value });
}
```

**Step 3: Commit**

```bash
git add src/types/ src/services/
git commit -m "feat: add TypeScript types and Tauri IPC service layer"
```

---

### Task 6: Zustand Stores

**Files:**
- Create: `src/stores/clipboardStore.ts`
- Create: `src/stores/settingsStore.ts`

**Step 1: Create clipboard store**

Create `src/stores/clipboardStore.ts`:

```typescript
import { create } from "zustand";
import type { ClipboardEntry, ContentType } from "../types";
import * as clipboardService from "../services/clipboardService";

interface ClipboardState {
  entries: ClipboardEntry[];
  selectedId: string | null;
  loading: boolean;
  typeFilter: ContentType | null;
  keyword: string;
  showFavoritesOnly: boolean;

  fetchHistory: () => Promise<void>;
  setTypeFilter: (filter: ContentType | null) => void;
  setKeyword: (keyword: string) => void;
  setShowFavoritesOnly: (show: boolean) => void;
  selectEntry: (id: string | null) => void;
  toggleFavorite: (id: string) => Promise<void>;
  deleteEntries: (ids: string[]) => Promise<void>;
  addEntry: (entry: ClipboardEntry) => void;
}

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  entries: [],
  selectedId: null,
  loading: false,
  typeFilter: null,
  keyword: "",
  showFavoritesOnly: false,

  fetchHistory: async () => {
    set({ loading: true });
    try {
      const entries = await clipboardService.getClipboardHistory({
        limit: 500,
        type_filter: get().typeFilter ?? undefined,
        keyword: get().keyword || undefined,
      });
      set({ entries, loading: false });
    } catch (e) {
      console.error("Failed to fetch history:", e);
      set({ loading: false });
    }
  },

  setTypeFilter: (filter) => {
    set({ typeFilter: filter });
    get().fetchHistory();
  },

  setKeyword: (keyword) => {
    set({ keyword });
    get().fetchHistory();
  },

  setShowFavoritesOnly: (show) => set({ showFavoritesOnly: show }),

  selectEntry: (id) => set({ selectedId: id }),

  toggleFavorite: async (id) => {
    const newState = await clipboardService.toggleFavorite(id);
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, is_favorite: newState } : e
      ),
    }));
  },

  deleteEntries: async (ids) => {
    await clipboardService.deleteEntries(ids);
    set((state) => ({
      entries: state.entries.filter((e) => !ids.includes(e.id)),
      selectedId:
        ids.includes(state.selectedId ?? "") ? null : state.selectedId,
    }));
  },

  addEntry: (entry) => {
    set((state) => ({
      entries: [entry, ...state.entries.filter((e) => e.id !== entry.id)],
    }));
  },
}));
```

Create `src/stores/settingsStore.ts`:

```typescript
import { create } from "zustand";
import * as settingsService from "../services/settingsService";

export type Theme = "light" | "dark" | "system";

interface SettingsState {
  theme: Theme;
  maxHistory: number;
  autoStart: boolean;
  pasteAndClose: boolean;

  loadSettings: () => Promise<void>;
  setTheme: (theme: Theme) => Promise<void>;
  setMaxHistory: (max: number) => Promise<void>;
  setAutoStart: (autoStart: boolean) => Promise<void>;
  setPasteAndClose: (value: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: "system",
  maxHistory: 1000,
  autoStart: false,
  pasteAndClose: true,

  loadSettings: async () => {
    const theme =
      ((await settingsService.getSetting("theme")) as Theme) ?? "system";
    const maxHistory = parseInt(
      (await settingsService.getSetting("max_history")) ?? "1000",
      10
    );
    const autoStart =
      (await settingsService.getSetting("auto_start")) === "true";
    const pasteAndClose =
      (await settingsService.getSetting("paste_and_close")) !== "false";
    set({ theme, maxHistory, autoStart, pasteAndClose });
  },

  setTheme: async (theme) => {
    await settingsService.updateSetting("theme", theme);
    set({ theme });
  },

  setMaxHistory: async (max) => {
    await settingsService.updateSetting("max_history", max.toString());
    set({ maxHistory: max });
  },

  setAutoStart: async (autoStart) => {
    await settingsService.updateSetting("auto_start", autoStart.toString());
    set({ autoStart });
  },

  setPasteAndClose: async (value) => {
    await settingsService.updateSetting("paste_and_close", value.toString());
    set({ pasteAndClose: value });
  },
}));
```

**Step 2: Commit**

```bash
git add src/stores/
git commit -m "feat: add Zustand stores for clipboard and settings state"
```

---

### Task 7: Main UI — Clipboard Panel

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/SearchBar.tsx`
- Create: `src/components/EntryCard.tsx`
- Create: `src/components/TypeFilter.tsx`
- Create: `src/pages/ClipboardPanel.tsx`
- Modify: `src/main.tsx` (ensure Tailwind + Sonner setup)
- Modify: `src/styles/globals.css` (Tailwind base)

**Step 1: Set up App.tsx as main shell**

Replace `src/App.tsx`:

```tsx
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { Toaster } from "sonner";
import { ClipboardPanel } from "./pages/ClipboardPanel";
import { useClipboardStore } from "./stores/clipboardStore";
import { useSettingsStore } from "./stores/settingsStore";
import type { ClipboardEntry } from "./types";

function App() {
  const addEntry = useClipboardStore((s) => s.addEntry);
  const fetchHistory = useClipboardStore((s) => s.fetchHistory);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    loadSettings();
    fetchHistory();

    const unlisten = listen<ClipboardEntry>("clipboard-changed", (event) => {
      addEntry(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme === "light") {
      root.classList.remove("dark");
    } else {
      // system
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [theme]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <ClipboardPanel />
      <Toaster position="bottom-right" />
    </div>
  );
}

export default App;
```

**Step 2: Create SearchBar component**

Create `src/components/SearchBar.tsx`:

```tsx
import { Search, X } from "lucide-react";
import { Input } from "./ui/input";
import { useClipboardStore } from "../stores/clipboardStore";
import { useRef } from "react";

export function SearchBar() {
  const keyword = useClipboardStore((s) => s.keyword);
  const setKeyword = useClipboardStore((s) => s.setKeyword);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Search clipboard..."
        className="pl-9 pr-8 h-8"
      />
      {keyword && (
        <button
          onClick={() => {
            setKeyword("");
            inputRef.current?.focus();
          }}
          className="absolute right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
```

**Step 3: Create TypeFilter component**

Create `src/components/TypeFilter.tsx`:

```tsx
import { FileText, Image, File, Star, LayoutGrid } from "lucide-react";
import { Button } from "./ui/button";
import { useClipboardStore } from "../stores/clipboardStore";
import type { ContentType } from "../types";
import { cn } from "../lib/utils";

const filters: { label: string; value: ContentType | null; icon: React.ReactNode }[] = [
  { label: "All", value: null, icon: <LayoutGrid className="h-4 w-4" /> },
  { label: "Text", value: "PlainText", icon: <FileText className="h-4 w-4" /> },
  { label: "Image", value: "Image", icon: <Image className="h-4 w-4" /> },
  { label: "File", value: "FilePaths", icon: <File className="h-4 w-4" /> },
];

export function TypeFilter() {
  const typeFilter = useClipboardStore((s) => s.typeFilter);
  const setTypeFilter = useClipboardStore((s) => s.setTypeFilter);
  const showFavoritesOnly = useClipboardStore((s) => s.showFavoritesOnly);
  const setShowFavoritesOnly = useClipboardStore((s) => s.setShowFavoritesOnly);

  return (
    <div className="flex flex-col gap-1 py-2">
      {filters.map((f) => (
        <Button
          key={f.label}
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowFavoritesOnly(false);
            setTypeFilter(f.value);
          }}
          className={cn(
            "justify-start gap-2 h-8",
            typeFilter === f.value && !showFavoritesOnly && "bg-accent"
          )}
        >
          {f.icon}
          {f.label}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
        className={cn(
          "justify-start gap-2 h-8",
          showFavoritesOnly && "bg-accent"
        )}
      >
        <Star className="h-4 w-4" />
        Favorites
      </Button>
    </div>
  );
}
```

**Step 4: Create EntryCard component**

Create `src/components/EntryCard.tsx`:

```tsx
import { Star, Trash2, Copy } from "lucide-react";
import { Button } from "./ui/button";
import type { ClipboardEntry } from "../types";
import { useClipboardStore } from "../stores/clipboardStore";
import { cn } from "../lib/utils";

interface EntryCardProps {
  entry: ClipboardEntry;
}

export function EntryCard({ entry }: EntryCardProps) {
  const selectedId = useClipboardStore((s) => s.selectedId);
  const selectEntry = useClipboardStore((s) => s.selectEntry);
  const toggleFavorite = useClipboardStore((s) => s.toggleFavorite);
  const deleteEntries = useClipboardStore((s) => s.deleteEntries);
  const isSelected = selectedId === entry.id;

  const timeAgo = getTimeAgo(entry.created_at);

  const preview =
    entry.content_type === "PlainText" || entry.content_type === "RichText"
      ? entry.text_content?.slice(0, 200) ?? ""
      : entry.content_type === "Image"
      ? "[Image]"
      : entry.text_content ?? "[File]";

  return (
    <div
      onClick={() => selectEntry(entry.id)}
      className={cn(
        "px-3 py-2 cursor-pointer border-b border-border hover:bg-accent/50 transition-colors",
        isSelected && "bg-accent"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm flex-1 line-clamp-3 break-all">{preview}</p>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(entry.id);
            }}
          >
            <Star
              className={cn(
                "h-3.5 w-3.5",
                entry.is_favorite && "fill-yellow-400 text-yellow-400"
              )}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              deleteEntries([entry.id]);
            }}
          >
            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
        <span>{entry.content_type}</span>
        {entry.source_app && (
          <>
            <span>·</span>
            <span>{entry.source_app}</span>
          </>
        )}
        <span>·</span>
        <span>{timeAgo}</span>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
```

**Step 5: Create ClipboardPanel page**

Create `src/pages/ClipboardPanel.tsx`:

```tsx
import { Virtuoso } from "react-virtuoso";
import { SearchBar } from "../components/SearchBar";
import { TypeFilter } from "../components/TypeFilter";
import { EntryCard } from "../components/EntryCard";
import { useClipboardStore } from "../stores/clipboardStore";
import { Settings } from "lucide-react";
import { Button } from "../components/ui/button";

export function ClipboardPanel() {
  const entries = useClipboardStore((s) => s.entries);
  const showFavoritesOnly = useClipboardStore((s) => s.showFavoritesOnly);

  const filteredEntries = showFavoritesOnly
    ? entries.filter((e) => e.is_favorite)
    : entries;

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-[100px] border-r border-border flex flex-col p-2 shrink-0">
        <TypeFilter />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 p-2 border-b border-border">
          <div className="flex-1">
            <SearchBar />
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {/* Entry list */}
        <div className="flex-1">
          {filteredEntries.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              No clipboard entries yet
            </div>
          ) : (
            <Virtuoso
              data={filteredEntries}
              itemContent={(_, entry) => (
                <EntryCard key={entry.id} entry={entry} />
              )}
            />
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border text-xs text-muted-foreground">
          <span>{filteredEntries.length} items</span>
        </div>
      </div>
    </div>
  );
}
```

**Step 6: Verify build**

```bash
pnpm tauri dev
```

Expected: Window shows the clipboard panel UI with sidebar filters, search bar, and empty state message.

**Step 7: Commit**

```bash
git add src/
git commit -m "feat: add clipboard panel UI with search, type filter, and entry cards"
```

---

### Task 8: Global Hotkey & Window Management

**Files:**
- Modify: `src-tauri/src/lib.rs` (add hotkey registration + window visibility toggle)
- Modify: `src-tauri/tauri.conf.json` (window config: decorations, size, always-on-top, start hidden)

**Step 1: Configure window in tauri.conf.json**

Update the `windows` section in `src-tauri/tauri.conf.json`:

```json
{
  "windows": [
    {
      "label": "main",
      "title": "AlgerClipboard",
      "width": 600,
      "height": 500,
      "resizable": true,
      "decorations": false,
      "transparent": false,
      "alwaysOnTop": true,
      "visible": false,
      "skipTaskbar": true,
      "center": true
    }
  ]
}
```

**Step 2: Add global shortcut to toggle window**

In the `setup` closure of `lib.rs`, add after clipboard monitor starts:

```rust
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tauri::WebviewWindow;

// Inside setup, after monitor.start(...)
let main_window = app.get_webview_window("main").unwrap();

// Register global shortcut
let shortcut: Shortcut = "CmdOrCtrl+Shift+V".parse().unwrap();
app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
    if event.state == ShortcutState::Pressed {
        if main_window.is_visible().unwrap_or(false) {
            let _ = main_window.hide();
        } else {
            let _ = main_window.show();
            let _ = main_window.set_focus();
        }
    }
})?;
```

**Step 3: Add Escape to hide window (frontend side)**

Add to `src/App.tsx` in the `useEffect`:
```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    import("@tauri-apps/api/webviewWindow").then(({ getCurrentWebviewWindow }) => {
      getCurrentWebviewWindow().hide();
    });
  }
};
window.addEventListener("keydown", handleKeyDown);
// return cleanup function
```

**Step 4: Add system tray**

Add `tauri-plugin-tray` or use Tauri 2 built-in tray. In `lib.rs` setup:

```rust
use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
use tauri::menu::{Menu, MenuItem};

let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
let menu = Menu::with_items(app, &[&show, &quit])?;

let main_window_tray = app.get_webview_window("main").unwrap();
let _tray = TrayIconBuilder::new()
    .menu(&menu)
    .on_menu_event(move |app, event| {
        match event.id.as_ref() {
            "quit" => app.exit(0),
            "show" => {
                let _ = main_window_tray.show();
                let _ = main_window_tray.set_focus();
            }
            _ => {}
        }
    })
    .on_tray_icon_event(|tray, event| {
        if let tauri::tray::TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } = event {
            let app = tray.app_handle();
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }
    })
    .build(app)?;
```

**Step 5: Verify**

```bash
pnpm tauri dev
```

Expected: Window starts hidden. Press `Ctrl+Shift+V` → window appears. Press again → hides. System tray icon visible. Press `Esc` → window hides.

**Step 6: Commit**

```bash
git add .
git commit -m "feat: add global hotkey toggle, system tray, and window management"
```

---

### Task 9: Smart Paste (Simulate Keyboard)

**Files:**
- Create: `src-tauri/src/paste/mod.rs`
- Create: `src-tauri/src/paste/simulator.rs`
- Create: `src-tauri/src/commands/paste_cmd.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Create paste simulator**

Create `src-tauri/src/paste/simulator.rs`:

```rust
use arboard::Clipboard;
use std::thread;
use std::time::Duration;

/// Writes content to system clipboard and simulates Ctrl+V / Cmd+V
pub fn paste_text(text: &str) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_text(text).map_err(|e| e.to_string())?;

    // Small delay to ensure clipboard is set
    thread::sleep(Duration::from_millis(50));

    simulate_paste()?;
    Ok(())
}

pub fn paste_image(image_path: &std::path::Path) -> Result<(), String> {
    let img = image::open(image_path).map_err(|e| e.to_string())?;
    let rgba = img.to_rgba8();
    let (w, h) = (rgba.width() as usize, rgba.height() as usize);
    let img_data = arboard::ImageData {
        width: w,
        height: h,
        bytes: std::borrow::Cow::Owned(rgba.into_raw()),
    };
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard.set_image(img_data).map_err(|e| e.to_string())?;

    thread::sleep(Duration::from_millis(50));
    simulate_paste()?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn simulate_paste() -> Result<(), String> {
    use std::mem;
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::*;

    unsafe {
        let mut inputs: [INPUT; 4] = mem::zeroed();

        // Ctrl down
        inputs[0].r#type = INPUT_KEYBOARD;
        inputs[0].Anonymous.ki.wVk = VK_CONTROL;

        // V down
        inputs[1].r#type = INPUT_KEYBOARD;
        inputs[1].Anonymous.ki.wVk = 0x56; // V key

        // V up
        inputs[2].r#type = INPUT_KEYBOARD;
        inputs[2].Anonymous.ki.wVk = 0x56;
        inputs[2].Anonymous.ki.dwFlags = KEYEVENTF_KEYUP;

        // Ctrl up
        inputs[3].r#type = INPUT_KEYBOARD;
        inputs[3].Anonymous.ki.wVk = VK_CONTROL;
        inputs[3].Anonymous.ki.dwFlags = KEYEVENTF_KEYUP;

        SendInput(4, inputs.as_ptr(), mem::size_of::<INPUT>() as i32);
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn simulate_paste() -> Result<(), String> {
    std::process::Command::new("osascript")
        .arg("-e")
        .arg("tell application \"System Events\" to keystroke \"v\" using command down")
        .output()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn simulate_paste() -> Result<(), String> {
    // Try xdotool first
    let result = std::process::Command::new("xdotool")
        .args(["key", "ctrl+v"])
        .output();

    match result {
        Ok(_) => Ok(()),
        Err(_) => {
            // Fallback to wtype for Wayland
            std::process::Command::new("wtype")
                .args(["-M", "ctrl", "-k", "v", "-m", "ctrl"])
                .output()
                .map_err(|e| format!("Neither xdotool nor wtype available: {}", e))?;
            Ok(())
        }
    }
}
```

Create `src-tauri/src/paste/mod.rs`:
```rust
pub mod simulator;
```

**Step 2: Add windows-sys crate (Windows only)**

In `src-tauri/Cargo.toml`:
```toml
[target.'cfg(target_os = "windows")'.dependencies]
windows-sys = { version = "0.59", features = ["Win32_UI_Input_KeyboardAndMouse"] }
```

**Step 3: Create paste command**

Create `src-tauri/src/commands/paste_cmd.rs`:

```rust
use crate::commands::clipboard_cmd::AppDatabase;
use crate::paste::simulator;
use crate::storage::blob::BlobStore;
use std::sync::Arc;
use tauri::{Manager, State, WebviewWindow};

pub struct AppBlobStore(pub Arc<BlobStore>);

#[tauri::command]
pub async fn paste_entry(
    window: WebviewWindow,
    db: State<'_, AppDatabase>,
    blob_store: State<'_, AppBlobStore>,
    id: String,
    mode: Option<String>,
) -> Result<(), String> {
    let entry = db
        .0
        .get_entry(&id)
        .map_err(|e| e.to_string())?
        .ok_or("Entry not found")?;

    // Hide window first
    let _ = window.hide();
    std::thread::sleep(std::time::Duration::from_millis(100));

    match entry.content_type {
        crate::clipboard::entry::ContentType::PlainText
        | crate::clipboard::entry::ContentType::RichText => {
            let text = entry.text_content.unwrap_or_default();
            simulator::paste_text(&text)?;
        }
        crate::clipboard::entry::ContentType::Image => {
            if let Some(blob_path) = &entry.blob_path {
                let full_path = blob_store.0.get_blob_path(blob_path);
                simulator::paste_image(&full_path)?;
            }
        }
        crate::clipboard::entry::ContentType::FilePaths => {
            let text = entry.text_content.unwrap_or_default();
            simulator::paste_text(&text)?;
        }
    }

    Ok(())
}
```

**Step 4: Register paste command and BlobStore state in lib.rs**

Add `AppBlobStore` to managed state, register `paste_entry` command.

**Step 5: Add frontend paste handling**

In `src/services/clipboardService.ts`:
```typescript
export async function pasteEntry(id: string, mode?: string): Promise<void> {
  return invoke("paste_entry", { id, mode: mode ?? null });
}
```

In `EntryCard.tsx`, add double-click or Enter to paste.

In `ClipboardPanel.tsx`, add keyboard listener for Enter key to paste selected entry.

**Step 6: Verify**

```bash
pnpm tauri dev
```

Copy some text, open panel with `Ctrl+Shift+V`, select an entry, press Enter — text should paste into previous app.

**Step 7: Commit**

```bash
git add .
git commit -m "feat: add smart paste with simulated keyboard input"
```

---

### Task 10: Settings Page

**Files:**
- Create: `src/pages/Settings.tsx`
- Modify: `src/App.tsx` (add settings route/toggle)

**Step 1: Create Settings page**

Create `src/pages/Settings.tsx`:

```tsx
import { useSettingsStore, type Theme } from "../stores/settingsStore";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Separator } from "../components/ui/separator";
import { ArrowLeft, Sun, Moon, Monitor } from "lucide-react";

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const { theme, maxHistory, pasteAndClose, setTheme, setMaxHistory, setPasteAndClose } =
    useSettingsStore();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Theme */}
        <section>
          <h3 className="text-sm font-medium mb-2">Theme</h3>
          <div className="flex gap-2">
            {(["light", "dark", "system"] as Theme[]).map((t) => (
              <Button
                key={t}
                variant={theme === t ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(t)}
                className="gap-1.5"
              >
                {t === "light" && <Sun className="h-3.5 w-3.5" />}
                {t === "dark" && <Moon className="h-3.5 w-3.5" />}
                {t === "system" && <Monitor className="h-3.5 w-3.5" />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Button>
            ))}
          </div>
        </section>

        <Separator />

        {/* History limit */}
        <section>
          <h3 className="text-sm font-medium mb-2">Max History Entries</h3>
          <Input
            type="number"
            value={maxHistory}
            onChange={(e) => setMaxHistory(parseInt(e.target.value) || 1000)}
            className="w-32"
            min={100}
            max={10000}
          />
        </section>

        <Separator />

        {/* Paste behavior */}
        <section>
          <h3 className="text-sm font-medium mb-2">Paste Behavior</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={pasteAndClose}
              onChange={(e) => setPasteAndClose(e.target.checked)}
              className="rounded"
            />
            Close panel after paste
          </label>
        </section>
      </div>
    </div>
  );
}
```

**Step 2: Add settings toggle to App.tsx**

Add a `showSettings` state. When settings icon clicked in ClipboardPanel, show Settings page instead.

**Step 3: Commit**

```bash
git add .
git commit -m "feat: add settings page with theme, history limit, and paste behavior"
```

---

### Task 11: Polish & Build Verification

**Step 1: Add custom window title bar**

Create `src/components/TitleBar.tsx` with drag region, minimize/close buttons for frameless window.

**Step 2: Add focus management**

Auto-focus search bar when panel opens. Arrow keys to navigate entries.

**Step 3: Test full flow on Windows**

```bash
pnpm tauri build
```

Expected: Builds `.msi` installer in `src-tauri/target/release/bundle/`.

Test: Install → opens in tray → Ctrl+Shift+V shows panel → copy text → appears in history → select and Enter → pastes → Esc hides.

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: polish UI with title bar, focus management, and keyboard navigation"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffolding | Tauri + React + deps |
| 2 | Data models & SQLite | `storage/`, `clipboard/entry.rs` |
| 3 | Clipboard monitor | `clipboard/monitor.rs` |
| 4 | Tauri IPC commands | `commands/`, `lib.rs` |
| 5 | TS types & services | `types/`, `services/` |
| 6 | Zustand stores | `stores/` |
| 7 | Clipboard panel UI | `pages/`, `components/` |
| 8 | Global hotkey & tray | `lib.rs`, `tauri.conf.json` |
| 9 | Smart paste | `paste/simulator.rs` |
| 10 | Settings page | `pages/Settings.tsx` |
| 11 | Polish & build | Title bar, focus, final build |
