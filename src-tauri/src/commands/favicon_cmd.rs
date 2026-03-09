use tauri::Manager;

#[tauri::command]
pub async fn fetch_favicon(
    app: tauri::AppHandle,
    service_id: String,
    domain: String,
) -> Result<String, String> {
    let cache_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?
        .join("favicons");

    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create favicon cache dir: {}", e))?;

    let filename = format!("{}.png", service_id);
    let cache_path = cache_dir.join(&filename);

    // Return cached favicon if it exists
    if cache_path.exists() {
        return cache_path
            .to_str()
            .map(|s| s.to_string())
            .ok_or_else(|| "Failed to convert path to string".to_string());
    }

    // Fetch from Google Favicon API
    let url = format!("https://www.google.com/s2/favicons?domain={}&sz=64", domain);

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to fetch favicon: {}", e))?;

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read favicon bytes: {}", e))?;

    std::fs::write(&cache_path, &bytes)
        .map_err(|e| format!("Failed to write favicon to cache: {}", e))?;

    cache_path
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to convert path to string".to_string())
}
