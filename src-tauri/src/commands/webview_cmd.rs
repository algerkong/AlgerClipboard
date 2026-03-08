use tauri::Manager;

/// Execute JavaScript in a WebView window identified by label.
#[tauri::command]
pub async fn eval_webview_js(
    app: tauri::AppHandle,
    label: String,
    js: String,
) -> Result<(), String> {
    let webview = app
        .get_webview_window(&label)
        .ok_or_else(|| format!("WebView '{}' not found", label))?;
    webview
        .eval(&js)
        .map_err(|e| format!("JS eval failed: {}", e))
}
