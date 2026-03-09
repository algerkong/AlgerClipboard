use crate::clipboard::entry::{ClipboardEntry, ContentType, SyncStatus};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Template {
    pub id: String,
    pub title: String,
    pub content: String,
    pub group_name: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeCount {
    pub content_type: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyCount {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipboardStats {
    pub total: i64,
    pub favorites: i64,
    pub pinned: i64,
    pub type_counts: Vec<TypeCount>,
    pub daily_trend: Vec<DailyCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncAccount {
    pub id: String,
    pub provider: String,
    pub config: String,
    pub sync_frequency: String,
    pub interval_minutes: Option<i64>,
    pub encryption_enabled: bool,
    pub last_sync_at: Option<String>,
    pub last_sync_version: i64,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagSummary {
    pub tag: String,
    pub count: i64,
}

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &std::path::Path) -> Result<Self, String> {
        let conn =
            Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to set pragmas: {}", e))?;

        let db = Database {
            conn: Mutex::new(conn),
        };
        db.create_tables()?;
        Ok(db)
    }

    fn create_tables(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS entries (
                id TEXT PRIMARY KEY,
                content_type TEXT NOT NULL,
                text_content TEXT,
                html_content TEXT,
                blob_path TEXT,
                thumbnail_path TEXT,
                content_hash TEXT NOT NULL,
                source_app TEXT,
                source_url TEXT,
                source_icon TEXT,
                device_id TEXT NOT NULL,
                is_favorite INTEGER DEFAULT 0,
                is_pinned INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                synced_at TEXT,
                sync_status TEXT DEFAULT 'local',
                deleted INTEGER DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_entries_content_hash ON entries(content_hash);
            CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_entries_content_type ON entries(content_type);
            CREATE INDEX IF NOT EXISTS idx_entries_is_favorite ON entries(is_favorite);

            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id TEXT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
                tag TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tag_catalog (
                name TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                group_name TEXT DEFAULT 'default',
                sort_order INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            ",
        )
        .map_err(|e| format!("Failed to create tables: {}", e))?;

        // Migration: add is_pinned column if it doesn't exist (for existing DBs)
        let _ = conn.execute_batch("ALTER TABLE entries ADD COLUMN is_pinned INTEGER DEFAULT 0;");

        // Migration: add sync_version column
        let _ =
            conn.execute_batch("ALTER TABLE entries ADD COLUMN sync_version INTEGER DEFAULT 0;");

        // Migration: add ai_summary column
        let _ = conn.execute_batch("ALTER TABLE entries ADD COLUMN ai_summary TEXT;");

        // Migration: add content_category and detected_language columns
        let _ = conn.execute("ALTER TABLE entries ADD COLUMN content_category TEXT", []);
        let _ = conn.execute("ALTER TABLE entries ADD COLUMN detected_language TEXT", []);
        let _ = conn.execute("ALTER TABLE entries ADD COLUMN source_url TEXT", []);
        let _ = conn.execute("ALTER TABLE entries ADD COLUMN source_icon TEXT", []);

        // Migration: add file_meta column
        let _ = conn.execute("ALTER TABLE entries ADD COLUMN file_meta TEXT", []);

        // Sync accounts table
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS sync_accounts (
                id TEXT PRIMARY KEY,
                provider TEXT NOT NULL,
                config TEXT NOT NULL,
                sync_frequency TEXT NOT NULL DEFAULT 'manual',
                interval_minutes INTEGER,
                encryption_enabled INTEGER DEFAULT 0,
                last_sync_at TEXT,
                last_sync_version INTEGER DEFAULT 0,
                enabled INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );",
        )
        .map_err(|e| format!("Failed to create sync_accounts table: {}", e))?;

        conn.execute(
            "INSERT OR IGNORE INTO tag_catalog (name, created_at)
             SELECT DISTINCT tag, DATETIME('now')
             FROM tags
             WHERE TRIM(tag) <> ''",
            [],
        )
        .map_err(|e| format!("Failed to migrate tag catalog: {}", e))?;

        Ok(())
    }

    pub fn insert_entry(&self, entry: &ClipboardEntry) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        conn.execute(
            "INSERT OR REPLACE INTO entries (id, content_type, text_content, html_content, blob_path, thumbnail_path, content_hash, source_app, source_url, source_icon, device_id, is_favorite, is_pinned, created_at, updated_at, synced_at, sync_status, sync_version, ai_summary, content_category, detected_language, file_meta, deleted)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, 0)",
            params![
                entry.id,
                entry.content_type.as_str(),
                entry.text_content,
                entry.html_content,
                entry.blob_path,
                entry.thumbnail_path,
                entry.content_hash,
                entry.source_app,
                entry.source_url,
                entry.source_icon,
                entry.device_id,
                entry.is_favorite as i32,
                entry.is_pinned as i32,
                entry.created_at,
                entry.updated_at,
                entry.synced_at,
                entry.sync_status.as_str(),
                entry.sync_version,
                entry.ai_summary,
                entry.content_category,
                entry.detected_language,
                entry.file_meta,
            ],
        )
        .map_err(|e| format!("Failed to insert entry: {}", e))?;

        // Insert tags
        for tag in &entry.tags {
            Self::ensure_tag_catalog_with_conn(&conn, tag)?;
            conn.execute(
                "INSERT INTO tags (entry_id, tag) VALUES (?1, ?2)",
                params![entry.id, tag],
            )
            .map_err(|e| format!("Failed to insert tag: {}", e))?;
        }

        Ok(())
    }

    pub fn find_by_hash(&self, hash: &str) -> Result<Option<ClipboardEntry>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let mut stmt = conn
            .prepare(
                "SELECT id, content_type, text_content, html_content, blob_path, thumbnail_path, content_hash, source_app, source_url, source_icon, device_id, is_favorite, is_pinned, created_at, updated_at, synced_at, sync_status, sync_version, ai_summary, content_category, detected_language, file_meta
                 FROM entries WHERE content_hash = ?1 AND deleted = 0 LIMIT 1",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let mut rows = stmt
            .query_map(params![hash], |row| Ok(row_to_entry_inner(row)))
            .map_err(|e| format!("Query error: {}", e))?;

        match rows.next() {
            Some(Ok(entry)) => {
                let mut entry = entry;
                let tags = self.get_tags_for_entry_with_conn(&conn, &entry.id)?;
                entry.tags = tags;
                Ok(Some(entry))
            }
            Some(Err(e)) => Err(format!("Row error: {}", e)),
            None => Ok(None),
        }
    }

    pub fn get_history(
        &self,
        limit: i64,
        offset: i64,
        type_filter: Option<String>,
        keyword: Option<String>,
        tag_filter: Option<String>,
        tagged_only: bool,
    ) -> Result<Vec<ClipboardEntry>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let mut sql = String::from(
            "SELECT id, content_type, text_content, html_content, blob_path, thumbnail_path, content_hash, source_app, source_url, source_icon, device_id, is_favorite, is_pinned, created_at, updated_at, synced_at, sync_status, sync_version, ai_summary, content_category, detected_language, file_meta
             FROM entries WHERE deleted = 0",
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref tf) = type_filter {
            sql.push_str(" AND content_type = ?");
            param_values.push(Box::new(tf.clone()));
        }

        if let Some(ref kw) = keyword {
            sql.push_str(" AND text_content LIKE ?");
            param_values.push(Box::new(format!("%{}%", kw)));
        }

        if let Some(ref tag) = tag_filter {
            sql.push_str(" AND id IN (SELECT entry_id FROM tags WHERE tag = ?)");
            param_values.push(Box::new(tag.clone()));
        }

        if tagged_only {
            sql.push_str(" AND id IN (SELECT DISTINCT entry_id FROM tags)");
        }

        sql.push_str(" ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?");
        param_values.push(Box::new(limit));
        param_values.push(Box::new(offset));

        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Prepare error: {}", e))?;

        let entries = stmt
            .query_map(params_refs.as_slice(), |row| Ok(row_to_entry_inner(row)))
            .map_err(|e| format!("Query error: {}", e))?;

        let mut result = Vec::new();
        for entry_result in entries {
            let mut entry = entry_result.map_err(|e| format!("Row error: {}", e))?;
            let tags = self.get_tags_for_entry_with_conn(&conn, &entry.id)?;
            entry.tags = tags;
            result.push(entry);
        }

        Ok(result)
    }

    pub fn get_entry(&self, id: &str) -> Result<Option<ClipboardEntry>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let mut stmt = conn
            .prepare(
                "SELECT id, content_type, text_content, html_content, blob_path, thumbnail_path, content_hash, source_app, source_url, source_icon, device_id, is_favorite, is_pinned, created_at, updated_at, synced_at, sync_status, sync_version, ai_summary, content_category, detected_language, file_meta
                 FROM entries WHERE id = ?1 AND deleted = 0",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let mut rows = stmt
            .query_map(params![id], |row| Ok(row_to_entry_inner(row)))
            .map_err(|e| format!("Query error: {}", e))?;

        match rows.next() {
            Some(Ok(entry)) => {
                let mut entry = entry;
                let tags = self.get_tags_for_entry_with_conn(&conn, &entry.id)?;
                entry.tags = tags;
                Ok(Some(entry))
            }
            Some(Err(e)) => Err(format!("Row error: {}", e)),
            None => Ok(None),
        }
    }

    pub fn delete_entries(&self, ids: &[String]) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        for id in ids {
            conn.execute(
                "UPDATE entries SET deleted = 1, updated_at = ?1 WHERE id = ?2",
                params![now_iso(), id],
            )
            .map_err(|e| format!("Failed to delete entry: {}", e))?;
        }

        Ok(())
    }

    pub fn toggle_favorite(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        conn.execute(
            "UPDATE entries SET is_favorite = CASE WHEN is_favorite = 0 THEN 1 ELSE 0 END, updated_at = ?1 WHERE id = ?2",
            params![now_iso(), id],
        )
        .map_err(|e| format!("Failed to toggle favorite: {}", e))?;

        let new_state: bool = conn
            .query_row(
                "SELECT is_favorite FROM entries WHERE id = ?1",
                params![id],
                |row| {
                    let val: i32 = row.get(0)?;
                    Ok(val != 0)
                },
            )
            .map_err(|e| format!("Failed to read favorite state: {}", e))?;

        Ok(new_state)
    }

    pub fn toggle_pin(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        conn.execute(
            "UPDATE entries SET is_pinned = CASE WHEN is_pinned = 0 THEN 1 ELSE 0 END, updated_at = ?1 WHERE id = ?2",
            params![now_iso(), id],
        )
        .map_err(|e| format!("Failed to toggle pin: {}", e))?;

        let new_state: bool = conn
            .query_row(
                "SELECT is_pinned FROM entries WHERE id = ?1",
                params![id],
                |row| {
                    let val: i32 = row.get(0)?;
                    Ok(val != 0)
                },
            )
            .map_err(|e| format!("Failed to read pin state: {}", e))?;

        Ok(new_state)
    }

    pub fn update_entry_text(&self, id: &str, text: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        // Recompute content_hash
        let mut hasher = Sha256::new();
        hasher.update(text.as_bytes());
        let hash = format!("{:x}", hasher.finalize());
        conn.execute(
            "UPDATE entries SET text_content = ?1, content_hash = ?2, updated_at = datetime('now') WHERE id = ?3",
            params![text, hash, id],
        )
        .map_err(|e| format!("Failed to update entry text: {}", e))?;
        Ok(())
    }

    pub fn update_entry_summary(&self, id: &str, summary: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "UPDATE entries SET ai_summary = ?1 WHERE id = ?2",
            params![summary, id],
        )
        .map_err(|e| format!("Failed to update summary: {}", e))?;
        Ok(())
    }

    pub fn update_entry_timestamp(
        &self,
        id: &str,
        source_app: Option<&str>,
        source_url: Option<&str>,
        source_icon: Option<&str>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let now = now_iso();

        conn.execute(
            "UPDATE entries
             SET created_at = ?1,
                 updated_at = ?1,
                 source_app = COALESCE(?2, source_app),
                 source_url = COALESCE(?3, source_url),
                 source_icon = COALESCE(?4, source_icon)
             WHERE id = ?5",
            params![now, source_app, source_url, source_icon, id],
        )
        .map_err(|e| format!("Failed to update timestamp: {}", e))?;

        Ok(())
    }

    /// Cleanup entries older than the given number of days (preserves favorites and pinned)
    pub fn cleanup_expired_entries(&self, days: i64) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let cutoff = chrono::Utc::now() - chrono::Duration::days(days);
        let cutoff_str = cutoff.to_rfc3339();

        let count = conn.execute(
            "UPDATE entries SET deleted = 1 WHERE deleted = 0 AND is_favorite = 0 AND is_pinned = 0 AND created_at < ?1",
            params![cutoff_str],
        )
        .map_err(|e| format!("Failed to cleanup expired entries: {}", e))?;

        Ok(count as i64)
    }

    /// Run both count-based and time-based cleanup
    pub fn auto_cleanup(&self, max_count: i64, expire_days: Option<i64>) -> Result<(), String> {
        self.cleanup_old_entries(max_count)?;
        if let Some(days) = expire_days {
            if days > 0 {
                self.cleanup_expired_entries(days)?;
            }
        }
        Ok(())
    }

    pub fn cleanup_old_entries(&self, max_count: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        conn.execute(
            "UPDATE entries SET deleted = 1 WHERE id IN (
                SELECT id FROM entries
                WHERE deleted = 0 AND is_favorite = 0
                ORDER BY created_at DESC
                LIMIT -1 OFFSET ?1
            )",
            params![max_count],
        )
        .map_err(|e| format!("Failed to cleanup old entries: {}", e))?;

        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let result = conn.query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        );

        match result {
            Ok(value) => Ok(Some(value)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to get setting: {}", e)),
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)",
            params![key, value, now_iso()],
        )
        .map_err(|e| format!("Failed to set setting: {}", e))?;

        Ok(())
    }

    pub fn clear_history(&self, keep_favorites: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        if keep_favorites {
            conn.execute(
                "UPDATE entries SET deleted = 1, updated_at = ?1 WHERE is_favorite = 0",
                params![now_iso()],
            )
            .map_err(|e| format!("Failed to clear history: {}", e))?;
        } else {
            conn.execute(
                "UPDATE entries SET deleted = 1, updated_at = ?1",
                params![now_iso()],
            )
            .map_err(|e| format!("Failed to clear history: {}", e))?;
        }

        Ok(())
    }

    fn get_tags_for_entry_with_conn(
        &self,
        conn: &Connection,
        entry_id: &str,
    ) -> Result<Vec<String>, String> {
        let mut stmt = conn
            .prepare("SELECT tag FROM tags WHERE entry_id = ?1")
            .map_err(|e| format!("Prepare error: {}", e))?;

        let tags = stmt
            .query_map(params![entry_id], |row| row.get(0))
            .map_err(|e| format!("Query error: {}", e))?;

        let mut result = Vec::new();
        for tag_result in tags {
            result.push(tag_result.map_err(|e| format!("Row error: {}", e))?);
        }

        Ok(result)
    }

    // --- Statistics ---

    pub fn get_clipboard_stats(&self) -> Result<ClipboardStats, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let total: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM entries WHERE deleted = 0",
                [],
                |row| row.get(0),
            )
            .map_err(|e| format!("Stats error: {}", e))?;

        let favorites: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM entries WHERE deleted = 0 AND is_favorite = 1",
                [],
                |row| row.get(0),
            )
            .map_err(|e| format!("Stats error: {}", e))?;

        let pinned: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM entries WHERE deleted = 0 AND is_pinned = 1",
                [],
                |row| row.get(0),
            )
            .map_err(|e| format!("Stats error: {}", e))?;

        // Type distribution
        let mut stmt = conn.prepare(
            "SELECT content_type, COUNT(*) FROM entries WHERE deleted = 0 GROUP BY content_type"
        ).map_err(|e| format!("Prepare error: {}", e))?;

        let type_counts: Vec<TypeCount> = stmt
            .query_map([], |row| {
                Ok(TypeCount {
                    content_type: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|e| format!("Query error: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        // Daily trend (last 7 days)
        let mut stmt = conn
            .prepare(
                "SELECT DATE(created_at) as day, COUNT(*) as cnt
             FROM entries WHERE deleted = 0 AND created_at >= DATE('now', '-7 days')
             GROUP BY day ORDER BY day",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let daily_trend: Vec<DailyCount> = stmt
            .query_map([], |row| {
                Ok(DailyCount {
                    date: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|e| format!("Query error: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(ClipboardStats {
            total,
            favorites,
            pinned,
            type_counts,
            daily_trend,
        })
    }

    // --- Tag Operations ---

    fn ensure_tag_catalog_with_conn(conn: &Connection, tag: &str) -> Result<(), String> {
        let normalized = tag.trim();
        if normalized.is_empty() {
            return Ok(());
        }

        conn.execute(
            "INSERT OR IGNORE INTO tag_catalog (name, created_at) VALUES (?1, DATETIME('now'))",
            params![normalized],
        )
        .map_err(|e| format!("Failed to ensure tag exists: {}", e))?;

        Ok(())
    }

    pub fn create_tag(&self, tag: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        Self::ensure_tag_catalog_with_conn(&conn, tag)
    }

    pub fn add_tag(&self, entry_id: &str, tag: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let normalized = tag.trim();

        if normalized.is_empty() {
            return Ok(());
        }

        // Check if tag already exists for this entry
        let exists: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM tags WHERE entry_id = ?1 AND tag = ?2",
                params![entry_id, normalized],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if exists {
            return Ok(());
        }

        Self::ensure_tag_catalog_with_conn(&conn, normalized)?;

        conn.execute(
            "INSERT INTO tags (entry_id, tag) VALUES (?1, ?2)",
            params![entry_id, normalized],
        )
        .map_err(|e| format!("Failed to add tag: {}", e))?;

        Ok(())
    }

    pub fn remove_tag(&self, entry_id: &str, tag: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        conn.execute(
            "DELETE FROM tags WHERE entry_id = ?1 AND tag = ?2",
            params![entry_id, tag],
        )
        .map_err(|e| format!("Failed to remove tag: {}", e))?;

        Ok(())
    }

    pub fn get_all_tags(&self) -> Result<Vec<String>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let mut stmt = conn
            .prepare("SELECT name FROM tag_catalog ORDER BY LOWER(name), name")
            .map_err(|e| format!("Prepare error: {}", e))?;

        let tags = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| format!("Query error: {}", e))?;

        let mut result = Vec::new();
        for tag in tags {
            result.push(tag.map_err(|e| format!("Row error: {}", e))?);
        }

        Ok(result)
    }

    pub fn get_tag_summaries(&self) -> Result<Vec<TagSummary>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let mut stmt = conn
            .prepare(
                "SELECT tag_catalog.name, COUNT(DISTINCT tags.entry_id) AS count
                 FROM tag_catalog
                 LEFT JOIN tags ON tags.tag = tag_catalog.name
                 GROUP BY tag_catalog.name
                 ORDER BY LOWER(tag_catalog.name), tag_catalog.name",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(TagSummary {
                    tag: row.get(0)?,
                    count: row.get(1)?,
                })
            })
            .map_err(|e| format!("Query error: {}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        Ok(result)
    }

    pub fn rename_tag(&self, old_tag: &str, new_tag: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let old_tag = old_tag.trim();
        let new_tag = new_tag.trim();

        if old_tag.is_empty() || new_tag.is_empty() || old_tag == new_tag {
            return Ok(());
        }

        Self::ensure_tag_catalog_with_conn(&conn, new_tag)?;

        conn.execute(
            "DELETE FROM tags
             WHERE tag = ?2
               AND entry_id IN (SELECT entry_id FROM tags WHERE tag = ?1)",
            params![old_tag, new_tag],
        )
        .map_err(|e| format!("Failed to merge duplicate tags: {}", e))?;

        conn.execute(
            "UPDATE tags SET tag = ?2 WHERE tag = ?1",
            params![old_tag, new_tag],
        )
        .map_err(|e| format!("Failed to rename tag: {}", e))?;

        conn.execute("DELETE FROM tag_catalog WHERE name = ?1", params![old_tag])
            .map_err(|e| format!("Failed to remove old tag from catalog: {}", e))?;

        Ok(())
    }

    pub fn delete_tag_everywhere(&self, tag: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let normalized = tag.trim();

        conn.execute("DELETE FROM tags WHERE tag = ?1", params![normalized])
            .map_err(|e| format!("Failed to delete tag: {}", e))?;
        conn.execute(
            "DELETE FROM tag_catalog WHERE name = ?1",
            params![normalized],
        )
        .map_err(|e| format!("Failed to delete tag from catalog: {}", e))?;

        Ok(())
    }

    // --- Template CRUD ---

    pub fn create_template(
        &self,
        title: &str,
        content: &str,
        group_name: &str,
    ) -> Result<Template, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let id = uuid::Uuid::new_v4().to_string();
        let now = now_iso();

        conn.execute(
            "INSERT INTO templates (id, title, content, group_name, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 0, ?5, ?5)",
            params![id, title, content, group_name, now],
        )
        .map_err(|e| format!("Failed to create template: {}", e))?;

        Ok(Template {
            id,
            title: title.to_string(),
            content: content.to_string(),
            group_name: group_name.to_string(),
            sort_order: 0,
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn get_templates(&self, group: Option<&str>) -> Result<Vec<Template>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let (sql, param_values): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match group {
            Some(g) => (
                "SELECT id, title, content, group_name, sort_order, created_at, updated_at FROM templates WHERE group_name = ? ORDER BY sort_order, created_at DESC".to_string(),
                vec![Box::new(g.to_string()) as Box<dyn rusqlite::types::ToSql>],
            ),
            None => (
                "SELECT id, title, content, group_name, sort_order, created_at, updated_at FROM templates ORDER BY sort_order, created_at DESC".to_string(),
                vec![],
            ),
        };

        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Prepare error: {}", e))?;

        let rows = stmt
            .query_map(params_refs.as_slice(), |row| {
                Ok(Template {
                    id: row.get("id")?,
                    title: row.get("title")?,
                    content: row.get("content")?,
                    group_name: row.get("group_name")?,
                    sort_order: row.get("sort_order")?,
                    created_at: row.get("created_at")?,
                    updated_at: row.get("updated_at")?,
                })
            })
            .map_err(|e| format!("Query error: {}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| format!("Row error: {}", e))?);
        }

        Ok(result)
    }

    pub fn get_template(&self, id: &str) -> Result<Option<Template>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let result = conn.query_row(
            "SELECT id, title, content, group_name, sort_order, created_at, updated_at FROM templates WHERE id = ?1",
            params![id],
            |row| {
                Ok(Template {
                    id: row.get("id")?,
                    title: row.get("title")?,
                    content: row.get("content")?,
                    group_name: row.get("group_name")?,
                    sort_order: row.get("sort_order")?,
                    created_at: row.get("created_at")?,
                    updated_at: row.get("updated_at")?,
                })
            },
        );

        match result {
            Ok(t) => Ok(Some(t)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to get template: {}", e)),
        }
    }

    pub fn update_template(
        &self,
        id: &str,
        title: &str,
        content: &str,
        group_name: &str,
    ) -> Result<Template, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let now = now_iso();

        let rows_affected = conn
            .execute(
                "UPDATE templates SET title = ?1, content = ?2, group_name = ?3, updated_at = ?4 WHERE id = ?5",
                params![title, content, group_name, now, id],
            )
            .map_err(|e| format!("Failed to update template: {}", e))?;

        if rows_affected == 0 {
            return Err("Template not found".to_string());
        }

        // Read back the full row
        let t = conn.query_row(
            "SELECT id, title, content, group_name, sort_order, created_at, updated_at FROM templates WHERE id = ?1",
            params![id],
            |row| {
                Ok(Template {
                    id: row.get("id")?,
                    title: row.get("title")?,
                    content: row.get("content")?,
                    group_name: row.get("group_name")?,
                    sort_order: row.get("sort_order")?,
                    created_at: row.get("created_at")?,
                    updated_at: row.get("updated_at")?,
                })
            },
        ).map_err(|e| format!("Failed to read updated template: {}", e))?;

        Ok(t)
    }

    pub fn delete_template(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        conn.execute("DELETE FROM templates WHERE id = ?1", params![id])
            .map_err(|e| format!("Failed to delete template: {}", e))?;

        Ok(())
    }

    // --- Export / Import ---

    pub fn export_all_entries(&self) -> Result<Vec<ClipboardEntry>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let mut stmt = conn
            .prepare(
                "SELECT id, content_type, text_content, html_content, blob_path, thumbnail_path, content_hash, source_app, source_url, source_icon, device_id, is_favorite, is_pinned, created_at, updated_at, synced_at, sync_status, sync_version, ai_summary, content_category, detected_language, file_meta
                 FROM entries WHERE deleted = 0 ORDER BY created_at DESC",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let entries = stmt
            .query_map([], |row| Ok(row_to_entry_inner(row)))
            .map_err(|e| format!("Query error: {}", e))?;

        let mut result = Vec::new();
        for entry_result in entries {
            let mut entry = entry_result.map_err(|e| format!("Row error: {}", e))?;
            let tags = self.get_tags_for_entry_with_conn(&conn, &entry.id)?;
            entry.tags = tags;
            result.push(entry);
        }

        Ok(result)
    }

    pub fn import_entries(&self, entries: &[ClipboardEntry]) -> Result<usize, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let mut count = 0;

        for entry in entries {
            // Skip if entry with same hash already exists
            let exists: bool = conn
                .query_row(
                    "SELECT COUNT(*) > 0 FROM entries WHERE content_hash = ?1 AND deleted = 0",
                    params![entry.content_hash],
                    |row| row.get(0),
                )
                .unwrap_or(false);

            if exists {
                continue;
            }

            conn.execute(
                "INSERT OR IGNORE INTO entries (id, content_type, text_content, html_content, blob_path, thumbnail_path, content_hash, source_app, source_url, source_icon, device_id, is_favorite, is_pinned, created_at, updated_at, synced_at, sync_status, deleted)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, 0)",
                params![
                    entry.id,
                    entry.content_type.as_str(),
                    entry.text_content,
                    entry.html_content,
                    entry.blob_path,
                    entry.thumbnail_path,
                    entry.content_hash,
                    entry.source_app,
                    entry.source_url,
                    entry.source_icon,
                    entry.device_id,
                    entry.is_favorite as i32,
                    entry.is_pinned as i32,
                    entry.created_at,
                    entry.updated_at,
                    entry.synced_at,
                    entry.sync_status.as_str(),
                ],
            )
            .map_err(|e| format!("Failed to import entry: {}", e))?;

            count += 1;
        }

        Ok(count)
    }

    pub fn get_entry_count(&self) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.query_row(
            "SELECT COUNT(*) FROM entries WHERE deleted = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count entries: {}", e))
    }

    /// Get all blob_path and thumbnail_path values from non-deleted entries
    pub fn get_all_blob_paths(&self) -> Result<(Vec<String>, Vec<String>), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let mut stmt = conn
            .prepare("SELECT blob_path, thumbnail_path FROM entries WHERE deleted = 0")
            .map_err(|e| format!("Prepare error: {}", e))?;

        let mut blob_paths = Vec::new();
        let mut thumb_paths = Vec::new();

        let rows = stmt
            .query_map([], |row| {
                let bp: Option<String> = row.get(0)?;
                let tp: Option<String> = row.get(1)?;
                Ok((bp, tp))
            })
            .map_err(|e| format!("Query error: {}", e))?;

        for row in rows {
            let (bp, tp) = row.map_err(|e| format!("Row error: {}", e))?;
            if let Some(b) = bp {
                blob_paths.push(b);
            }
            if let Some(t) = tp {
                thumb_paths.push(t);
            }
        }

        Ok((blob_paths, thumb_paths))
    }

    /// Get blob/thumbnail paths of non-favorite entries ordered by created_at ASC (oldest first)
    pub fn get_blobs_oldest_first(&self) -> Result<Vec<(Option<String>, Option<String>)>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let mut stmt = conn
            .prepare(
                "SELECT blob_path, thumbnail_path FROM entries
                 WHERE deleted = 0 AND is_favorite = 0 AND (blob_path IS NOT NULL OR thumbnail_path IS NOT NULL)
                 ORDER BY created_at ASC"
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let rows = stmt
            .query_map([], |row| {
                let bp: Option<String> = row.get(0)?;
                let tp: Option<String> = row.get(1)?;
                Ok((bp, tp))
            })
            .map_err(|e| format!("Query error: {}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        Ok(result)
    }

    // --- Sync Account CRUD ---

    pub fn create_sync_account(&self, account: &SyncAccount) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "INSERT INTO sync_accounts (id, provider, config, sync_frequency, interval_minutes, encryption_enabled, last_sync_at, last_sync_version, enabled, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                account.id, account.provider, account.config, account.sync_frequency,
                account.interval_minutes, account.encryption_enabled as i32,
                account.last_sync_at, account.last_sync_version, account.enabled as i32,
                account.created_at, account.updated_at
            ],
        ).map_err(|e| format!("Failed to create sync account: {}", e))?;
        Ok(())
    }

    pub fn get_sync_accounts(&self) -> Result<Vec<SyncAccount>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let mut stmt = conn.prepare(
            "SELECT id, provider, config, sync_frequency, interval_minutes, encryption_enabled, last_sync_at, last_sync_version, enabled, created_at, updated_at FROM sync_accounts ORDER BY created_at"
        ).map_err(|e| format!("Prepare error: {}", e))?;

        let rows = stmt
            .query_map([], |row| {
                let enc: i32 = row.get("encryption_enabled")?;
                let en: i32 = row.get("enabled")?;
                Ok(SyncAccount {
                    id: row.get("id")?,
                    provider: row.get("provider")?,
                    config: row.get("config")?,
                    sync_frequency: row.get("sync_frequency")?,
                    interval_minutes: row.get("interval_minutes")?,
                    encryption_enabled: enc != 0,
                    last_sync_at: row.get("last_sync_at")?,
                    last_sync_version: row.get("last_sync_version")?,
                    enabled: en != 0,
                    created_at: row.get("created_at")?,
                    updated_at: row.get("updated_at")?,
                })
            })
            .map_err(|e| format!("Query error: {}", e))?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        Ok(result)
    }

    pub fn get_sync_account(&self, id: &str) -> Result<Option<SyncAccount>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let result = conn.query_row(
            "SELECT id, provider, config, sync_frequency, interval_minutes, encryption_enabled, last_sync_at, last_sync_version, enabled, created_at, updated_at FROM sync_accounts WHERE id = ?1",
            params![id],
            |row| {
                let enc: i32 = row.get("encryption_enabled")?;
                let en: i32 = row.get("enabled")?;
                Ok(SyncAccount {
                    id: row.get("id")?,
                    provider: row.get("provider")?,
                    config: row.get("config")?,
                    sync_frequency: row.get("sync_frequency")?,
                    interval_minutes: row.get("interval_minutes")?,
                    encryption_enabled: enc != 0,
                    last_sync_at: row.get("last_sync_at")?,
                    last_sync_version: row.get("last_sync_version")?,
                    enabled: en != 0,
                    created_at: row.get("created_at")?,
                    updated_at: row.get("updated_at")?,
                })
            },
        );
        match result {
            Ok(a) => Ok(Some(a)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(format!("Failed to get sync account: {}", e)),
        }
    }

    pub fn update_sync_account(&self, account: &SyncAccount) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "UPDATE sync_accounts SET config = ?1, sync_frequency = ?2, interval_minutes = ?3, encryption_enabled = ?4, last_sync_at = ?5, last_sync_version = ?6, enabled = ?7, updated_at = ?8 WHERE id = ?9",
            params![
                account.config, account.sync_frequency, account.interval_minutes,
                account.encryption_enabled as i32, account.last_sync_at,
                account.last_sync_version, account.enabled as i32, account.updated_at, account.id
            ],
        ).map_err(|e| format!("Failed to update sync account: {}", e))?;
        Ok(())
    }

    pub fn delete_sync_account(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute("DELETE FROM sync_accounts WHERE id = ?1", params![id])
            .map_err(|e| format!("Failed to delete sync account: {}", e))?;
        Ok(())
    }

    pub fn get_entries_since_version(&self, version: i64) -> Result<Vec<ClipboardEntry>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        // Pick up entries that either:
        //   - have a sync_version greater than the last synced version, OR
        //   - have never been synced (sync_status = 'Local')
        let mut stmt = conn.prepare(
            "SELECT id, content_type, text_content, html_content, blob_path, thumbnail_path, content_hash, source_app, source_url, source_icon, device_id, is_favorite, is_pinned, created_at, updated_at, synced_at, sync_status, sync_version, ai_summary, content_category, detected_language, file_meta
             FROM entries WHERE (sync_version > ?1 OR sync_status = 'local') AND deleted = 0 ORDER BY created_at ASC"
        ).map_err(|e| format!("Prepare error: {}", e))?;

        let entries = stmt
            .query_map(params![version], |row| Ok(row_to_entry_inner(row)))
            .map_err(|e| format!("Query error: {}", e))?;

        let mut result = Vec::new();
        for entry_result in entries {
            let mut entry = entry_result.map_err(|e| format!("Row error: {}", e))?;
            let tags = self.get_tags_for_entry_with_conn(&conn, &entry.id)?;
            entry.tags = tags;
            result.push(entry);
        }
        Ok(result)
    }

    pub fn update_entry_sync_status(
        &self,
        id: &str,
        status: &str,
        synced_at: &str,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "UPDATE entries SET sync_status = ?1, synced_at = ?2, updated_at = ?3 WHERE id = ?4",
            params![status, synced_at, now_iso(), id],
        )
        .map_err(|e| format!("Failed to update sync status: {}", e))?;
        Ok(())
    }

    pub fn increment_sync_version(&self, id: &str) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "UPDATE entries SET sync_version = sync_version + 1, updated_at = ?1 WHERE id = ?2",
            params![now_iso(), id],
        )
        .map_err(|e| format!("Failed to increment sync version: {}", e))?;
        let version: i64 = conn
            .query_row(
                "SELECT sync_version FROM entries WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to read sync version: {}", e))?;
        Ok(version)
    }

    /// Get IDs of soft-deleted entries that were previously synced (need deletion propagated)
    pub fn get_deleted_synced_entry_ids(&self) -> Result<Vec<String>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let mut stmt = conn
            .prepare("SELECT id FROM entries WHERE deleted = 1 AND sync_version > 0")
            .map_err(|e| format!("Prepare error: {}", e))?;

        let ids = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Query error: {}", e))?
            .filter_map(|r| r.ok())
            .collect();
        Ok(ids)
    }

    /// Check if an entry exists in the database (including soft-deleted entries)
    pub fn entry_exists(&self, id: &str) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM entries WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Query error: {}", e))?;
        Ok(count > 0)
    }
}

fn row_to_entry_inner(row: &rusqlite::Row) -> ClipboardEntry {
    let content_type_str: String = row.get("content_type").unwrap_or_default();
    let sync_status_str: String = row.get("sync_status").unwrap_or_default();
    let is_fav: i32 = row.get("is_favorite").unwrap_or(0);
    let is_pin: i32 = row.get("is_pinned").unwrap_or(0);

    ClipboardEntry {
        id: row.get("id").unwrap_or_default(),
        content_type: ContentType::from_str(&content_type_str).unwrap_or(ContentType::PlainText),
        text_content: row.get("text_content").unwrap_or(None),
        html_content: row.get("html_content").unwrap_or(None),
        blob_path: row.get("blob_path").unwrap_or(None),
        thumbnail_path: row.get("thumbnail_path").unwrap_or(None),
        content_hash: row.get("content_hash").unwrap_or_default(),
        source_app: row.get("source_app").unwrap_or(None),
        source_url: row.get("source_url").unwrap_or(None),
        source_icon: row.get("source_icon").unwrap_or(None),
        device_id: row.get("device_id").unwrap_or_default(),
        is_favorite: is_fav != 0,
        is_pinned: is_pin != 0,
        tags: Vec::new(), // tags are loaded separately
        created_at: row.get("created_at").unwrap_or_default(),
        updated_at: row.get("updated_at").unwrap_or_default(),
        synced_at: row.get("synced_at").unwrap_or(None),
        sync_status: SyncStatus::from_str(&sync_status_str),
        sync_version: row.get("sync_version").unwrap_or(0),
        ai_summary: row.get("ai_summary").unwrap_or(None),
        content_category: row.get("content_category").unwrap_or(None),
        detected_language: row.get("detected_language").unwrap_or(None),
        file_meta: row.get("file_meta").unwrap_or(None),
    }
}

pub fn compute_hash(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::{now_iso, Database};
    use crate::clipboard::entry::{ClipboardEntry, ContentType, SyncStatus};
    use std::{env, fs};
    use uuid::Uuid;

    #[test]
    fn insert_entry_persists_category_and_language() {
        let db_path = env::temp_dir().join(format!("alger-clipboard-test-{}.db", Uuid::new_v4()));
        let db = Database::new(&db_path).expect("database should initialize");

        let now = now_iso();
        let entry = ClipboardEntry {
            id: Uuid::new_v4().to_string(),
            content_type: ContentType::PlainText,
            text_content: Some("copied text".into()),
            html_content: None,
            blob_path: None,
            thumbnail_path: None,
            content_hash: "hash".into(),
            source_app: Some("Finder".into()),
            source_url: Some("https://example.com".into()),
            source_icon: Some("data:image/png;base64,Zm9v".into()),
            device_id: "test-device".into(),
            is_favorite: false,
            is_pinned: false,
            tags: Vec::new(),
            created_at: now.clone(),
            updated_at: now,
            synced_at: None,
            sync_status: SyncStatus::Local,
            sync_version: 0,
            ai_summary: None,
            content_category: Some("text".into()),
            detected_language: Some("zh".into()),
            file_meta: None,
        };

        db.insert_entry(&entry)
            .expect("entry insert should succeed");

        let stored = db
            .get_entry(&entry.id)
            .expect("entry should be queryable")
            .expect("inserted entry should be returned");

        assert_eq!(stored.content_category.as_deref(), Some("text"));
        assert_eq!(stored.detected_language.as_deref(), Some("zh"));
        assert_eq!(stored.source_url.as_deref(), Some("https://example.com"));
        assert_eq!(
            stored.source_icon.as_deref(),
            Some("data:image/png;base64,Zm9v")
        );

        let _ = fs::remove_file(&db_path);
    }
}
