use tauri::{Manager, WebviewUrl};

fn ask_ai_top_inset(single_service: bool) -> f64 {
    if single_service {
        return 0.0;
    }

    #[cfg(target_os = "macos")]
    {
        28.0
    }

    #[cfg(not(target_os = "macos"))]
    {
        0.0
    }
}

#[cfg(target_os = "macos")]
fn bring_tab_bar_to_front_impl(app: &tauri::AppHandle) -> Result<(), String> {
    let tab_bar = app
        .get_webview("ask-ai-tab-bar")
        .ok_or_else(|| "Tab bar webview not found".to_string())?;

    tab_bar
        .with_webview(|platform_wv| {
            use objc2::rc::Retained;
            use objc2_app_kit::NSView;

            unsafe {
                let ns_view_ptr = platform_wv.inner() as *mut NSView;
                if ns_view_ptr.is_null() {
                    return;
                }
                let ns_view = &*ns_view_ptr;

                if let Some(superview) = ns_view.superview() {
                    let retained: Retained<NSView> = Retained::retain(ns_view_ptr).unwrap();
                    ns_view.removeFromSuperview();
                    superview.addSubview(&retained);
                }
            }
        })
        .map_err(|e| format!("with_webview failed: {}", e))
}

#[cfg(not(target_os = "macos"))]
fn bring_tab_bar_to_front_impl(_app: &tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

/// Create the ask-ai-panel window with the React tab bar as a child webview.
/// Uses a bare Window so the tab bar and service webviews are at the same z-level.
#[tauri::command]
pub async fn create_ask_ai_panel(
    app: tauri::AppHandle,
    tab_bar_height: f64,
    single_service: bool,
    width: Option<f64>,
    height: Option<f64>,
) -> Result<(), String> {
    let label = "ask-ai-panel";

    // If window already exists, just show and focus it
    if let Some(existing) = app.get_window(label) {
        existing.show().map_err(|e| format!("Failed to show: {}", e))?;
        existing.set_focus().map_err(|e| format!("Failed to focus: {}", e))?;
        return Ok(());
    }

    let w = width.unwrap_or(1000.0);
    let h = height.unwrap_or(700.0);

    // Create a bare window (no main webview)
    let window = tauri::WindowBuilder::new(&app, label)
        .title("Ask AI")
        .inner_size(w, h)
        .min_inner_size(600.0, 400.0)
        .resizable(true)
        .center()
        .shadow(true)
        .build()
        .map_err(|e| format!("Failed to create window: {}", e))?;

    // Add the React tab bar as a child webview at the top
    let bar_h = if single_service { 0.0 } else { tab_bar_height };
    let top_inset = ask_ai_top_inset(single_service);
    let win_size = window.inner_size().map_err(|e| format!("Failed to get size: {}", e))?;
    let scale = window.scale_factor().map_err(|e| format!("Failed to get scale: {}", e))?;
    let logical_w = win_size.width as f64 / scale;
    let logical_h = win_size.height as f64 / scale;

    let tab_bar_builder = tauri::webview::WebviewBuilder::new(
        "ask-ai-tab-bar",
        WebviewUrl::App("index.html?window=ask-ai".into()),
    );

    window
        .add_child(
            tab_bar_builder,
            tauri::Position::Logical(tauri::LogicalPosition::new(0.0, top_inset)),
            tauri::Size::Logical(tauri::LogicalSize::new(
                logical_w,
                if bar_h > 0.0 { bar_h } else { logical_h },
            )),
        )
        .map_err(|e| format!("Failed to add tab bar webview: {}", e))?;

    Ok(())
}

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

#[tauri::command]
pub async fn webview_exists(app: tauri::AppHandle, label: String) -> Result<bool, String> {
    Ok(app.get_webview(&label).is_some() || app.get_webview_window(&label).is_some())
}

/// Convert a service ID string into a deterministic 16-byte array.
/// Same logic as the JS `serviceIdToDataStoreId` function.
#[cfg(target_os = "macos")]
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

    let _ = bring_tab_bar_to_front_impl(&app);

    Ok(())
}

/// Resize the tab bar webview (used on window resize).
#[tauri::command]
pub async fn resize_tab_bar(
    app: tauri::AppHandle,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let webview = app
        .get_webview("ask-ai-tab-bar")
        .ok_or_else(|| "Tab bar webview not found".to_string())?;
    webview
        .set_position(tauri::Position::Logical(tauri::LogicalPosition::new(0.0, y)))
        .map_err(|e| format!("Failed to reposition tab bar: {}", e))?;
    webview
        .set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)))
        .map_err(|e| format!("Failed to resize tab bar: {}", e))?;
    bring_tab_bar_to_front_impl(&app)
}

/// Bring the tab bar webview to the front of the z-order on macOS.
/// On macOS, child webviews added later sit on top of earlier ones (NSView subview ordering).
/// This command re-inserts the tab bar's underlying NSView so it renders above service webviews.
#[tauri::command]
pub async fn bring_tab_bar_to_front(app: tauri::AppHandle) -> Result<(), String> {
    bring_tab_bar_to_front_impl(&app)
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
        .map_err(|e| format!("Failed to show webview: {}", e))?;
    let _ = bring_tab_bar_to_front_impl(&app);
    Ok(())
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
        .map_err(|e| format!("Failed to set size: {}", e))?;
    let _ = bring_tab_bar_to_front_impl(&app);
    Ok(())
}
