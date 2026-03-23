use crate::commands::clipboard_cmd::AppDatabase;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpotlightHistoryEntry {
    pub id: String,
    pub title: String,
    pub subtitle: Option<String>,
    pub mode_id: String,
    pub mode_name: String,
    pub original_result_id: String,
    pub query: String,
    pub timestamp: String,
}

const HISTORY_SETTING_KEY: &str = "spotlight_history";
const DEFAULT_MAX_HISTORY: usize = 200;

fn read_history(db: &crate::storage::database::Database) -> Vec<SpotlightHistoryEntry> {
    let json = db
        .get_setting(HISTORY_SETTING_KEY)
        .ok()
        .flatten()
        .unwrap_or_default();
    if json.is_empty() {
        return Vec::new();
    }
    serde_json::from_str(&json).unwrap_or_default()
}

fn write_history(
    db: &crate::storage::database::Database,
    entries: &[SpotlightHistoryEntry],
) -> Result<(), String> {
    let json = serde_json::to_string(entries).map_err(|e| e.to_string())?;
    db.set_setting(HISTORY_SETTING_KEY, &json)
}

#[tauri::command]
pub fn add_spotlight_history(
    db: State<'_, AppDatabase>,
    entry: SpotlightHistoryEntry,
) -> Result<(), String> {
    let mut history = read_history(&db.0);

    // Remove duplicate if same original_result_id exists
    history.retain(|e| e.original_result_id != entry.original_result_id);

    // Insert at front
    history.insert(0, entry);

    // Trim to max
    let max = db
        .0
        .get_setting("spotlight_history_max")
        .ok()
        .flatten()
        .and_then(|s| s.parse::<usize>().ok())
        .unwrap_or(DEFAULT_MAX_HISTORY);
    history.truncate(max);

    write_history(&db.0, &history)
}

#[tauri::command]
pub fn get_spotlight_history(
    db: State<'_, AppDatabase>,
    query: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<SpotlightHistoryEntry>, String> {
    let history = read_history(&db.0);
    let limit = limit.unwrap_or(50);

    match query {
        Some(q) if !q.trim().is_empty() => {
            let q_lower = q.to_lowercase();
            Ok(history
                .into_iter()
                .filter(|e| {
                    e.title.to_lowercase().contains(&q_lower)
                        || e.subtitle
                            .as_deref()
                            .unwrap_or("")
                            .to_lowercase()
                            .contains(&q_lower)
                })
                .take(limit)
                .collect())
        }
        _ => Ok(history.into_iter().take(limit).collect()),
    }
}

#[tauri::command]
pub fn remove_spotlight_history(db: State<'_, AppDatabase>, id: String) -> Result<(), String> {
    let mut history = read_history(&db.0);
    history.retain(|e| e.id != id);
    write_history(&db.0, &history)
}

#[tauri::command]
pub fn clear_spotlight_history(db: State<'_, AppDatabase>) -> Result<(), String> {
    db.0.set_setting(HISTORY_SETTING_KEY, "[]")
}
