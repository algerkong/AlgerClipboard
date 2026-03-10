use regex::Regex;
use rusqlite::{functions::FunctionFlags, params, Connection};

use super::pinyin_utils::to_pinyin_text;
use super::query_parser::{parse_query, SearchQuery};
use crate::clipboard::entry::ClipboardEntry;

/// Initialize FTS5 virtual table and search_history table.
pub fn init_fts(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
            entry_id UNINDEXED,
            text_content,
            ai_summary,
            source_app,
            file_names,
            tags_text,
            pinyin_text,
            content_type UNINDEXED,
            created_at UNINDEXED,
            tokenize='unicode61 remove_diacritics 2'
        );

        CREATE TABLE IF NOT EXISTS search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            keyword TEXT NOT NULL UNIQUE,
            search_count INTEGER DEFAULT 1,
            last_used_at TEXT NOT NULL
        );",
    )
    .map_err(|e| format!("Failed to init FTS tables: {}", e))?;

    Ok(())
}

/// Register custom REGEXP function for regex search support.
pub fn register_regexp(conn: &Connection) -> Result<(), String> {
    conn.create_scalar_function("regexp", 2, FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC, |ctx| {
        let pattern_str = ctx.get_raw(0).as_str().unwrap_or("");
        let text = ctx.get_raw(1).as_str().unwrap_or("");

        let matched = match Regex::new(pattern_str) {
            Ok(re) => re.is_match(text),
            Err(_) => false,
        };
        Ok(matched)
    })
    .map_err(|e| format!("Failed to register REGEXP function: {}", e))?;

    Ok(())
}

/// Extract file names from the file_meta JSON string.
/// file_meta is a JSON array of objects with a "name" field.
pub fn extract_file_names(file_meta: Option<&str>) -> String {
    let Some(meta_str) = file_meta else {
        return String::new();
    };

    if let Ok(arr) = serde_json::from_str::<Vec<serde_json::Value>>(meta_str) {
        arr.iter()
            .filter_map(|v| v.get("name").and_then(|n| n.as_str()))
            .collect::<Vec<_>>()
            .join(" ")
    } else {
        String::new()
    }
}

/// Index (insert or replace) an entry in the FTS index.
pub fn index_entry(
    conn: &Connection,
    entry: &ClipboardEntry,
    tags: &[String],
) -> Result<(), String> {
    // First remove existing entry if any
    let _ = remove_entry(conn, &entry.id);

    let text_content = entry.text_content.as_deref().unwrap_or("");
    let ai_summary = entry.ai_summary.as_deref().unwrap_or("");
    let source_app = entry.source_app.as_deref().unwrap_or("");
    let file_names = extract_file_names(entry.file_meta.as_deref());
    let tags_text = tags.join(" ");
    let pinyin_text = to_pinyin_text(text_content);
    let content_type = entry.content_type.as_str();
    let created_at = &entry.created_at;

    conn.execute(
        "INSERT INTO entries_fts (entry_id, text_content, ai_summary, source_app, file_names, tags_text, pinyin_text, content_type, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            entry.id,
            text_content,
            ai_summary,
            source_app,
            file_names,
            tags_text,
            pinyin_text,
            content_type,
            created_at,
        ],
    )
    .map_err(|e| format!("Failed to index entry: {}", e))?;

    Ok(())
}

/// Remove an entry from the FTS index.
pub fn remove_entry(conn: &Connection, entry_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM entries_fts WHERE entry_id = ?1",
        params![entry_id],
    )
    .map_err(|e| format!("Failed to remove entry from FTS: {}", e))?;
    Ok(())
}

/// Update tags text for an entry in the FTS index.
pub fn update_tags(conn: &Connection, entry_id: &str, tags: &[String]) -> Result<(), String> {
    let tags_text = tags.join(" ");
    conn.execute(
        "UPDATE entries_fts SET tags_text = ?1 WHERE entry_id = ?2",
        params![tags_text, entry_id],
    )
    .map_err(|e| format!("Failed to update tags in FTS: {}", e))?;
    Ok(())
}

/// Update AI summary for an entry in the FTS index.
pub fn update_summary(conn: &Connection, entry_id: &str, summary: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE entries_fts SET ai_summary = ?1 WHERE entry_id = ?2",
        params![summary, entry_id],
    )
    .map_err(|e| format!("Failed to update summary in FTS: {}", e))?;
    Ok(())
}

/// Convert a time range string to an ISO date string for filtering.
/// Returns the start date for the given range.
pub fn time_range_to_date(range: &str) -> Option<String> {
    let now = chrono::Local::now();
    let date = match range {
        "today" => now.format("%Y-%m-%d").to_string(),
        "3days" => (now - chrono::Duration::days(3))
            .format("%Y-%m-%d")
            .to_string(),
        "week" => (now - chrono::Duration::days(7))
            .format("%Y-%m-%d")
            .to_string(),
        "month" => (now - chrono::Duration::days(30))
            .format("%Y-%m-%d")
            .to_string(),
        "3months" => (now - chrono::Duration::days(90))
            .format("%Y-%m-%d")
            .to_string(),
        _ => return None,
    };
    Some(date)
}

/// Execute a search query and return matching entry IDs.
#[allow(clippy::too_many_arguments)]
pub fn search(
    conn: &Connection,
    input: &str,
    time_range: Option<&str>,
    type_filter: Option<&str>,
    tag_filter: Option<&str>,
    tagged_only: bool,
    limit: usize,
    offset: usize,
) -> Result<Vec<String>, String> {
    let query = parse_query(
        input,
        time_range.map(|s| s.to_string()),
        type_filter.map(|s| s.to_string()),
    );

    match query {
        SearchQuery::Fts {
            match_expr,
            time_range,
            type_filter,
        } => search_fts(
            conn,
            &match_expr,
            time_range.as_deref(),
            type_filter.as_deref(),
            tag_filter,
            tagged_only,
            limit,
            offset,
        ),
        SearchQuery::Regex {
            pattern,
            time_range,
            type_filter,
        } => search_regex(
            conn,
            &pattern,
            time_range.as_deref(),
            type_filter.as_deref(),
            tag_filter,
            tagged_only,
            limit,
            offset,
        ),
    }
}

/// Execute FTS5 MATCH search.
fn search_fts(
    conn: &Connection,
    match_expr: &str,
    time_range: Option<&str>,
    type_filter: Option<&str>,
    tag_filter: Option<&str>,
    tagged_only: bool,
    limit: usize,
    offset: usize,
) -> Result<Vec<String>, String> {
    if match_expr.is_empty() {
        return Ok(vec![]);
    }

    let mut sql = String::from(
        "SELECT entry_id FROM entries_fts WHERE entries_fts MATCH ?1",
    );
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    param_values.push(Box::new(match_expr.to_string()));

    let mut param_idx = 2;

    if let Some(range) = time_range {
        if let Some(date) = time_range_to_date(range) {
            sql.push_str(&format!(" AND created_at >= ?{}", param_idx));
            param_values.push(Box::new(date));
            param_idx += 1;
        }
    }

    if let Some(ct) = type_filter {
        sql.push_str(&format!(" AND content_type = ?{}", param_idx));
        param_values.push(Box::new(ct.to_string()));
        param_idx += 1;
    }

    if let Some(tag) = tag_filter {
        sql.push_str(&format!(" AND tags_text LIKE ?{}", param_idx));
        param_values.push(Box::new(format!("%{}%", tag)));
        param_idx += 1;
    }

    if tagged_only {
        sql.push_str(" AND tags_text != ''");
    }

    sql.push_str(" ORDER BY rank");
    sql.push_str(&format!(" LIMIT ?{} OFFSET ?{}", param_idx, param_idx + 1));
    param_values.push(Box::new(limit as i64));
    param_values.push(Box::new(offset as i64));

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("FTS query prepare error: {}", e))?;

    let rows = stmt
        .query_map(params_refs.as_slice(), |row| row.get::<_, String>(0))
        .map_err(|e| format!("FTS query error: {}", e))?;

    let mut ids = Vec::new();
    for row in rows {
        if let Ok(id) = row {
            ids.push(id);
        }
    }

    Ok(ids)
}

/// Execute regex search on the entries table directly.
fn search_regex(
    conn: &Connection,
    pattern: &str,
    time_range: Option<&str>,
    type_filter: Option<&str>,
    tag_filter: Option<&str>,
    tagged_only: bool,
    limit: usize,
    offset: usize,
) -> Result<Vec<String>, String> {
    // Validate the regex pattern
    Regex::new(pattern).map_err(|e| format!("Invalid regex pattern: {}", e))?;

    let mut sql = String::from(
        "SELECT f.entry_id FROM entries_fts f WHERE (
            f.text_content REGEXP ?1
            OR f.ai_summary REGEXP ?1
            OR f.file_names REGEXP ?1
            OR f.source_app REGEXP ?1
        )",
    );
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    param_values.push(Box::new(pattern.to_string()));

    let mut param_idx = 2;

    if let Some(range) = time_range {
        if let Some(date) = time_range_to_date(range) {
            sql.push_str(&format!(" AND f.created_at >= ?{}", param_idx));
            param_values.push(Box::new(date));
            param_idx += 1;
        }
    }

    if let Some(ct) = type_filter {
        sql.push_str(&format!(" AND f.content_type = ?{}", param_idx));
        param_values.push(Box::new(ct.to_string()));
        param_idx += 1;
    }

    if let Some(tag) = tag_filter {
        sql.push_str(&format!(" AND f.tags_text LIKE ?{}", param_idx));
        param_values.push(Box::new(format!("%{}%", tag)));
        param_idx += 1;
    }

    if tagged_only {
        sql.push_str(" AND f.tags_text != ''");
    }

    sql.push_str(&format!(
        " ORDER BY f.created_at DESC LIMIT ?{} OFFSET ?{}",
        param_idx,
        param_idx + 1
    ));
    param_values.push(Box::new(limit as i64));
    param_values.push(Box::new(offset as i64));

    let params_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Regex query prepare error: {}", e))?;

    let rows = stmt
        .query_map(params_refs.as_slice(), |row| row.get::<_, String>(0))
        .map_err(|e| format!("Regex query error: {}", e))?;

    let mut ids = Vec::new();
    for row in rows {
        if let Ok(id) = row {
            ids.push(id);
        }
    }

    Ok(ids)
}

/// Rebuild the entire FTS index from the entries table.
/// Returns the number of entries indexed.
pub fn rebuild_index(conn: &Connection) -> Result<usize, String> {
    // Clear existing FTS data
    conn.execute("DELETE FROM entries_fts", [])
        .map_err(|e| format!("Failed to clear FTS index: {}", e))?;

    // Query all entries
    let mut stmt = conn
        .prepare(
            "SELECT e.id, e.content_type, e.text_content, e.ai_summary, e.source_app,
                    e.file_meta, e.created_at
             FROM entries e
             ORDER BY e.created_at DESC",
        )
        .map_err(|e| format!("Failed to prepare rebuild query: {}", e))?;

    let entries: Vec<(String, String, Option<String>, Option<String>, Option<String>, Option<String>, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, Option<String>>(5)?,
                row.get::<_, String>(6)?,
            ))
        })
        .map_err(|e| format!("Failed to query entries for rebuild: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let count = entries.len();

    for (id, content_type, text_content, ai_summary, source_app, file_meta, created_at) in &entries
    {
        // Get tags for this entry
        let tags: Vec<String> = conn
            .prepare("SELECT t.name FROM tags t INNER JOIN entry_tags et ON t.id = et.tag_id WHERE et.entry_id = ?1")
            .and_then(|mut s| {
                s.query_map(params![id], |row| row.get::<_, String>(0))
                    .map(|rows| rows.filter_map(|r| r.ok()).collect())
            })
            .unwrap_or_default();

        let text = text_content.as_deref().unwrap_or("");
        let summary = ai_summary.as_deref().unwrap_or("");
        let app = source_app.as_deref().unwrap_or("");
        let fnames = extract_file_names(file_meta.as_deref());
        let tags_text = tags.join(" ");
        let pinyin = to_pinyin_text(text);

        let _ = conn.execute(
            "INSERT INTO entries_fts (entry_id, text_content, ai_summary, source_app, file_names, tags_text, pinyin_text, content_type, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![id, text, summary, app, fnames, tags_text, pinyin, content_type, created_at],
        );
    }

    Ok(count)
}
