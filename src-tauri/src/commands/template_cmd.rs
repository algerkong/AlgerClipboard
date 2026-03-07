use crate::commands::clipboard_cmd::AppDatabase;
use crate::storage::database::Template;
use tauri::State;

/// Replace template variables with actual values.
fn apply_template_variables(content: &str) -> String {
    let now = chrono::Local::now();
    let mut result = content.to_string();

    result = result.replace("{date}", &now.format("%Y-%m-%d").to_string());
    result = result.replace("{time}", &now.format("%H:%M:%S").to_string());
    result = result.replace("{datetime}", &now.format("%Y-%m-%d %H:%M:%S").to_string());

    // Replace {clipboard} with current clipboard text
    if result.contains("{clipboard}") {
        let clipboard_text = arboard::Clipboard::new()
            .ok()
            .and_then(|mut cb| cb.get_text().ok())
            .unwrap_or_default();
        result = result.replace("{clipboard}", &clipboard_text);
    }

    result
}

#[tauri::command]
pub fn get_templates(
    db: State<'_, AppDatabase>,
    group: Option<String>,
) -> Result<Vec<Template>, String> {
    db.0.get_templates(group.as_deref())
}

#[tauri::command]
pub fn create_template(
    db: State<'_, AppDatabase>,
    title: String,
    content: String,
    group_name: Option<String>,
) -> Result<Template, String> {
    let group = group_name.as_deref().unwrap_or("default");
    db.0.create_template(&title, &content, group)
}

#[tauri::command]
pub fn update_template(
    db: State<'_, AppDatabase>,
    id: String,
    title: String,
    content: String,
    group_name: Option<String>,
) -> Result<Template, String> {
    let group = group_name.as_deref().unwrap_or("default");
    db.0.update_template(&id, &title, &content, group)
}

#[tauri::command]
pub fn delete_template(db: State<'_, AppDatabase>, id: String) -> Result<(), String> {
    db.0.delete_template(&id)
}

#[tauri::command]
pub fn apply_template(db: State<'_, AppDatabase>, id: String) -> Result<String, String> {
    let template =
        db.0.get_template(&id)?
            .ok_or_else(|| "Template not found".to_string())?;

    Ok(apply_template_variables(&template.content))
}
