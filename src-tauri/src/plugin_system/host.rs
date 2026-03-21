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

extern "C" fn host_get_setting(ctx: *mut c_void, key: *const c_char) -> *mut c_char {
    let host = ctx_ref(ctx);
    if !permissions::check_permission(&host.db, &host.plugin_id, "settings:read") {
        return std::ptr::null_mut();
    }
    let key_str = unsafe { ffi::c_to_string(key) };
    let full_key = format!("plugin:{}:{}", host.plugin_id, key_str);
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
    let full_key = format!("plugin:{}:{}", host.plugin_id, key_str);
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
    _method: *const c_char,
    _url: *const c_char,
    _headers: *const c_char,
    _body: *const c_char,
) -> *mut c_char {
    let host = ctx_ref(ctx);
    if !permissions::check_permission(&host.db, &host.plugin_id, "http") {
        return std::ptr::null_mut();
    }
    let result = r#"{"error":"http_request not yet implemented"}"#;
    CString::new(result).map(|c| c.into_raw()).unwrap_or(std::ptr::null_mut())
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
