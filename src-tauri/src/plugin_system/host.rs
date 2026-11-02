use crate::plugin_system::ffi::{self, HostVTable};
use crate::plugin_system::permissions;
use crate::storage::database::Database;
use std::ffi::{CString, c_char, c_int, c_void};
use std::sync::{Arc, Mutex};

#[allow(dead_code)]
pub struct HostContext {
    pub plugin_id: String,
    pub db: Arc<Database>,
    pub declared_permissions: Vec<String>,
    pub registered_commands: Mutex<Vec<String>>,
    pub app_handle: Option<tauri::AppHandle>,
}

pub fn build_vtable(ctx: *mut c_void) -> HostVTable {
    HostVTable {
        ctx,
        get_setting: host_get_setting,
        set_setting: host_set_setting,
        read_clipboard: host_read_clipboard,
        write_clipboard: host_write_clipboard,
        http_request: host_http_request,
        emit_event: host_emit_event,
        register_command: host_register_command,
        log: host_log,
        free_string: host_free_string,
    }
}

fn ctx_ref<'a>(ctx: *mut c_void) -> &'a HostContext {
    unsafe { &*(ctx as *const HostContext) }
}

/// Scope a setting key to the calling plugin. Some plugins pass the already
/// scoped key ("plugin:{id}:{key}"), others pass the bare key; accept both.
fn scoped_key(plugin_id: &str, key: &str) -> String {
    if key.starts_with("plugin:") {
        key.to_string()
    } else {
        format!("plugin:{}:{}", plugin_id, key)
    }
}

extern "C" fn host_get_setting(ctx: *mut c_void, key: *const c_char) -> *mut c_char {
    let host = ctx_ref(ctx);
    if !permissions::check_permission(&host.db, &host.plugin_id, "settings:read") {
        return std::ptr::null_mut();
    }
    let key_str = unsafe { ffi::c_to_string(key) };
    let full_key = scoped_key(&host.plugin_id, &key_str);
    match host.db.get_setting(&full_key) {
        Ok(Some(val)) => CString::new(val).map(|c| c.into_raw()).unwrap_or(std::ptr::null_mut()),
        _ => std::ptr::null_mut(),
    }
}

extern "C" fn host_set_setting(ctx: *mut c_void, key: *const c_char, value: *const c_char) -> c_int {
    let host = ctx_ref(ctx);
    if !permissions::check_permission(&host.db, &host.plugin_id, "settings:write") {
        return -1;
    }
    let key_str = unsafe { ffi::c_to_string(key) };
    let val_str = unsafe { ffi::c_to_string(value) };
    let full_key = scoped_key(&host.plugin_id, &key_str);
    match host.db.set_setting(&full_key, &val_str) {
        Ok(()) => 0,
        Err(_) => -1,
    }
}

extern "C" fn host_read_clipboard(ctx: *mut c_void) -> *mut c_char {
    let host = ctx_ref(ctx);
    if !permissions::check_permission(&host.db, &host.plugin_id, "clipboard:read") {
        return std::ptr::null_mut();
    }
    match arboard::Clipboard::new().and_then(|mut cb| cb.get_text()) {
        Ok(text) => CString::new(text).map(|c| c.into_raw()).unwrap_or(std::ptr::null_mut()),
        Err(_) => std::ptr::null_mut(),
    }
}

extern "C" fn host_write_clipboard(ctx: *mut c_void, content: *const c_char) -> c_int {
    let host = ctx_ref(ctx);
    if !permissions::check_permission(&host.db, &host.plugin_id, "clipboard:write") {
        return -1;
    }
    let text = unsafe { ffi::c_to_string(content) };
    match arboard::Clipboard::new().and_then(|mut cb| cb.set_text(text)) {
        Ok(()) => 0,
        Err(_) => -1,
    }
}

extern "C" fn host_http_request(
    ctx: *mut c_void,
    method: *const c_char,
    url: *const c_char,
    headers: *const c_char,
    body: *const c_char,
) -> *mut c_char {
    let host = ctx_ref(ctx);
    if !permissions::check_permission(&host.db, &host.plugin_id, "http") {
        return std::ptr::null_mut();
    }
    let method = unsafe { ffi::c_to_string(method) };
    let url = unsafe { ffi::c_to_string(url) };
    let headers = unsafe { ffi::c_to_string(headers) };
    let body = unsafe { ffi::c_to_string(body) };

    // Plugin commands are called synchronously from the Tauri command
    // thread, so run the request on a dedicated thread with its own runtime
    // instead of blocking on the app's async runtime.
    let result = std::thread::spawn(move || -> Option<String> {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .ok()?;
        rt.block_on(async move {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(20))
                .build()
                .ok()?;
            let req_method = reqwest::Method::from_bytes(method.as_bytes()).ok()?;
            let mut request = client.request(req_method, &url);

            if !headers.trim().is_empty() {
                if let Ok(map) = serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&headers) {
                    for (key, value) in map {
                        if let Some(value) = value.as_str() {
                            request = request.header(&key, value);
                        }
                    }
                }
            }
            if !body.is_empty() {
                request = request.body(body);
            }

            let response = request.send().await.ok()?;
            // Return the body regardless of status: plugins inspect API error
            // payloads (e.g. GitHub's {"message": ...}) themselves.
            response.text().await.ok()
        })
    })
    .join()
    .ok()
    .flatten();

    match result {
        Some(text) => CString::new(text).map(|c| c.into_raw()).unwrap_or(std::ptr::null_mut()),
        None => std::ptr::null_mut(),
    }
}

extern "C" fn host_emit_event(ctx: *mut c_void, event: *const c_char, payload: *const c_char) -> c_int {
    let host = ctx_ref(ctx);
    if !permissions::check_permission(&host.db, &host.plugin_id, "events") {
        return -1;
    }
    let event_str = unsafe { ffi::c_to_string(event) };
    let payload_str = unsafe { ffi::c_to_string(payload) };
    let full_event = format!("plugin:{}:{}", host.plugin_id, event_str);
    if let Some(ref handle) = host.app_handle {
        use tauri::Emitter;
        match handle.emit(&full_event, payload_str) {
            Ok(()) => 0,
            Err(_) => -1,
        }
    } else {
        -1
    }
}

extern "C" fn host_register_command(ctx: *mut c_void, name: *const c_char) -> c_int {
    let host = ctx_ref(ctx);
    if !permissions::check_permission(&host.db, &host.plugin_id, "commands") {
        return -1;
    }
    let name_str = unsafe { ffi::c_to_string(name) };
    if let Ok(mut cmds) = host.registered_commands.lock() {
        cmds.push(name_str);
        0
    } else {
        -1
    }
}

extern "C" fn host_log(ctx: *mut c_void, level: c_int, message: *const c_char) {
    let host = ctx_ref(ctx);
    let msg = unsafe { ffi::c_to_string(message) };
    let target = format!("plugin:{}", host.plugin_id);
    match level {
        0 => log::trace!(target: &target, "{}", msg),
        1 => log::debug!(target: &target, "{}", msg),
        2 => log::info!(target: &target, "{}", msg),
        3 => log::warn!(target: &target, "{}", msg),
        _ => log::error!(target: &target, "{}", msg),
    }
}

extern "C" fn host_free_string(_ctx: *mut c_void, s: *mut c_char) {
    unsafe { ffi::free_host_string(s) };
}
