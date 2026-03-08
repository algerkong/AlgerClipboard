use tauri::{Manager, WebviewUrl};

/// Execute JavaScript in a WebView identified by label.
/// Searches both WebviewWindow (old-style) and child Webview (new-style) by label.
#[tauri::command]
pub async fn eval_webview_js(
    app: tauri::AppHandle,
    label: String,
    js: String,
) -> Result<(), String> {
    // First try WebviewWindow (old-style label, e.g. "ai-webview-chatgpt")
    if let Some(webview_window) = app.get_webview_window(&label) {
        return webview_window
            .eval(&js)
            .map_err(|e| format!("JS eval failed: {}", e));
    }

    // Then try child Webview (new-style label, e.g. "ask-ai-svc-chatgpt")
    if let Some(webview) = app.get_webview(&label) {
        return webview
            .eval(&js)
            .map_err(|e| format!("JS eval failed: {}", e));
    }

    Err(format!("WebView '{}' not found", label))
}

/// Convert a service ID string into a deterministic 16-byte array.
/// Same logic as the JS `serviceIdToDataStoreId` function.
fn service_id_to_data_store_id(service_id: &str) -> [u8; 16] {
    let mut bytes = [0u8; 16];
    for (i, ch) in service_id.bytes().enumerate() {
        if i >= 16 {
            break;
        }
        bytes[i] = ch;
    }
    bytes
}

/// Create a child Webview inside the ask-ai-panel window for a given AI service.
/// Each service gets its own isolated session via dataStoreIdentifier (macOS) or dataDirectory (other).
/// If the webview already exists, just show it and return Ok.
#[tauri::command]
pub async fn create_ai_child_webview(
    app: tauri::AppHandle,
    parent_label: String,
    service_id: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let label = format!("ask-ai-svc-{}", service_id);

    // If webview already exists, just show it
    if let Some(existing) = app.get_webview(&label) {
        existing.show().map_err(|e| format!("Failed to show webview: {}", e))?;
        return Ok(());
    }

    let window = app
        .get_window(&parent_label)
        .ok_or_else(|| format!("Parent window '{}' not found", parent_label))?;

    let parsed_url: tauri::Url = url.parse().map_err(|e| format!("Invalid URL: {}", e))?;

    let mut builder = tauri::webview::WebviewBuilder::new(
        &label,
        WebviewUrl::External(parsed_url),
    );

    // Session isolation: macOS uses dataStoreIdentifier, others use dataDirectory
    #[cfg(target_os = "macos")]
    {
        builder = builder.data_store_identifier(service_id_to_data_store_id(&service_id));
    }

    #[cfg(not(target_os = "macos"))]
    {
        builder = builder.data_directory(std::path::PathBuf::from(&service_id));
    }

    let position = tauri::Position::Logical(tauri::LogicalPosition::new(x, y));
    let size = tauri::Size::Logical(tauri::LogicalSize::new(width, height));

    window
        .add_child(builder, position, size)
        .map_err(|e| format!("Failed to create child webview: {}", e))?;

    Ok(())
}

/// Show a child webview by service ID.
#[tauri::command]
pub async fn show_ai_webview(
    app: tauri::AppHandle,
    service_id: String,
) -> Result<(), String> {
    let label = format!("ask-ai-svc-{}", service_id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("Webview '{}' not found", label))?;
    webview
        .show()
        .map_err(|e| format!("Failed to show webview: {}", e))
}

/// Hide a child webview by service ID.
#[tauri::command]
pub async fn hide_ai_webview(
    app: tauri::AppHandle,
    service_id: String,
) -> Result<(), String> {
    let label = format!("ask-ai-svc-{}", service_id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("Webview '{}' not found", label))?;
    webview
        .hide()
        .map_err(|e| format!("Failed to hide webview: {}", e))
}

/// Resize and reposition a child webview by service ID.
#[tauri::command]
pub async fn resize_ai_webview(
    app: tauri::AppHandle,
    service_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let label = format!("ask-ai-svc-{}", service_id);
    let webview = app
        .get_webview(&label)
        .ok_or_else(|| format!("Webview '{}' not found", label))?;
    webview
        .set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)))
        .map_err(|e| format!("Failed to set position: {}", e))?;
    webview
        .set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)))
        .map_err(|e| format!("Failed to set size: {}", e))
}
