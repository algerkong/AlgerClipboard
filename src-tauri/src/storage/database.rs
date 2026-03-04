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

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &std::path::Path) -> Result<Self, String> {
        let conn = Connection::open(db_path).map_err(|e| format!("Failed to open database: {}", e))?;

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
                device_id TEXT NOT NULL,
                is_favorite INTEGER DEFAULT 0,
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

        Ok(())
    }

    pub fn insert_entry(&self, entry: &ClipboardEntry) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        conn.execute(
            "INSERT OR REPLACE INTO entries (id, content_type, text_content, html_content, blob_path, thumbnail_path, content_hash, source_app, device_id, is_favorite, created_at, updated_at, synced_at, sync_status, deleted)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 0)",
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
        )
        .map_err(|e| format!("Failed to insert entry: {}", e))?;

        // Insert tags
        for tag in &entry.tags {
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
                "SELECT id, content_type, text_content, html_content, blob_path, thumbnail_path, content_hash, source_app, device_id, is_favorite, created_at, updated_at, synced_at, sync_status
                 FROM entries WHERE content_hash = ?1 AND deleted = 0 LIMIT 1",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let mut rows = stmt
            .query_map(params![hash], |row| {
                Ok(row_to_entry_inner(row))
            })
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
    ) -> Result<Vec<ClipboardEntry>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let mut sql = String::from(
            "SELECT id, content_type, text_content, html_content, blob_path, thumbnail_path, content_hash, source_app, device_id, is_favorite, created_at, updated_at, synced_at, sync_status
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

        sql.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");
        param_values.push(Box::new(limit));
        param_values.push(Box::new(offset));

        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();

        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Prepare error: {}", e))?;

        let entries = stmt
            .query_map(params_refs.as_slice(), |row| {
                Ok(row_to_entry_inner(row))
            })
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
                "SELECT id, content_type, text_content, html_content, blob_path, thumbnail_path, content_hash, source_app, device_id, is_favorite, created_at, updated_at, synced_at, sync_status
                 FROM entries WHERE id = ?1 AND deleted = 0",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let mut rows = stmt
            .query_map(params![id], |row| {
                Ok(row_to_entry_inner(row))
            })
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

    pub fn update_entry_timestamp(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let now = now_iso();

        conn.execute(
            "UPDATE entries SET created_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )
        .map_err(|e| format!("Failed to update timestamp: {}", e))?;

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

        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare error: {}", e))?;

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
}

fn row_to_entry_inner(row: &rusqlite::Row) -> ClipboardEntry {
    let content_type_str: String = row.get("content_type").unwrap_or_default();
    let sync_status_str: String = row.get("sync_status").unwrap_or_default();
    let is_fav: i32 = row.get("is_favorite").unwrap_or(0);

    ClipboardEntry {
        id: row.get("id").unwrap_or_default(),
        content_type: ContentType::from_str(&content_type_str).unwrap_or(ContentType::PlainText),
        text_content: row.get("text_content").unwrap_or(None),
        html_content: row.get("html_content").unwrap_or(None),
        blob_path: row.get("blob_path").unwrap_or(None),
        thumbnail_path: row.get("thumbnail_path").unwrap_or(None),
        content_hash: row.get("content_hash").unwrap_or_default(),
        source_app: row.get("source_app").unwrap_or(None),
        device_id: row.get("device_id").unwrap_or_default(),
        is_favorite: is_fav != 0,
        tags: Vec::new(), // tags are loaded separately
        created_at: row.get("created_at").unwrap_or_default(),
        updated_at: row.get("updated_at").unwrap_or_default(),
        synced_at: row.get("synced_at").unwrap_or(None),
        sync_status: SyncStatus::from_str(&sync_status_str),
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
