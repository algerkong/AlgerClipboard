use crate::commands::clipboard_cmd::AppDatabase;
use crate::paste::smart_paste::SmartPasteConfig;
use tauri::State;

#[tauri::command]
pub fn get_smart_paste_config(db: State<'_, AppDatabase>) -> Result<SmartPasteConfig, String> {
    Ok(SmartPasteConfig::load(&db.0))
}

#[tauri::command]
pub fn save_smart_paste_config(
    db: State<'_, AppDatabase>,
    config: SmartPasteConfig,
) -> Result<(), String> {
    config.save(&db.0)
}

#[tauri::command]
pub fn reset_smart_paste_config(
    db: State<'_, AppDatabase>,
) -> Result<SmartPasteConfig, String> {
    let config = SmartPasteConfig::default();
    config.save(&db.0)?;
    Ok(config)
}
