use std::ffi::{CStr, CString, c_char, c_int, c_void};

#[repr(C)]
pub struct HostVTable {
    pub ctx: *mut c_void,
    pub get_setting: extern "C" fn(ctx: *mut c_void, key: *const c_char) -> *mut c_char,
    pub set_setting: extern "C" fn(ctx: *mut c_void, key: *const c_char, value: *const c_char) -> c_int,
    pub read_clipboard: extern "C" fn(ctx: *mut c_void) -> *mut c_char,
    pub write_clipboard: extern "C" fn(ctx: *mut c_void, content: *const c_char) -> c_int,
    pub http_request: extern "C" fn(ctx: *mut c_void, method: *const c_char, url: *const c_char, headers: *const c_char, body: *const c_char) -> *mut c_char,
    pub emit_event: extern "C" fn(ctx: *mut c_void, event: *const c_char, payload: *const c_char) -> c_int,
    pub register_command: extern "C" fn(ctx: *mut c_void, name: *const c_char) -> c_int,
    pub log: extern "C" fn(ctx: *mut c_void, level: c_int, message: *const c_char),
    pub free_string: extern "C" fn(ctx: *mut c_void, s: *mut c_char),
}

pub type PluginInitFn = unsafe extern "C" fn(host: *const HostVTable) -> c_int;
pub type PluginOnEventFn = unsafe extern "C" fn(event_type: *const c_char, payload: *const c_char) -> *mut c_char;
pub type PluginOnCommandFn = unsafe extern "C" fn(command: *const c_char, args: *const c_char) -> *mut c_char;
pub type PluginDestroyFn = unsafe extern "C" fn();
pub type PluginFreeStringFn = unsafe extern "C" fn(s: *mut c_char);

pub fn str_to_c(s: &str) -> CString {
    CString::new(s).unwrap_or_else(|_| CString::new("").unwrap())
}

pub unsafe fn c_to_string(ptr: *const c_char) -> String {
    if ptr.is_null() {
        return String::new();
    }
    unsafe { CStr::from_ptr(ptr) }.to_string_lossy().into_owned()
}

pub unsafe fn free_host_string(ptr: *mut c_char) {
    if !ptr.is_null() {
        drop(unsafe { CString::from_raw(ptr) });
    }
}
