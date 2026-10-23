use tauri::Manager;

/// Execute JavaScript in a WebView identified by label.
/// Searches both WebviewWindow (standalone AI service windows) and child Webview.
#[tauri::command]
pub async fn eval_webview_js(
    app: tauri::AppHandle,
    label: String,
    js: String,
) -> Result<(), String> {
    // First try WebviewWindow (e.g. "ai-webview-chatgpt")
    if let Some(webview_window) = app.get_webview_window(&label) {
        return webview_window
            .eval(&js)
            .map_err(|e| format!("JS eval failed: {}", e));
    }

    // Then try child Webview
    if let Some(webview) = app.get_webview(&label) {
        return webview
            .eval(&js)
            .map_err(|e| format!("JS eval failed: {}", e));
    }

    Err(format!("WebView '{}' not found", label))
}

#[tauri::command]
pub async fn webview_exists(app: tauri::AppHandle, label: String) -> Result<bool, String> {
    Ok(app.get_webview(&label).is_some() || app.get_webview_window(&label).is_some())
}
