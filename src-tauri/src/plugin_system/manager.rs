use crate::plugin_system::ffi::{self, HostVTable, PluginDestroyFn, PluginFreeStringFn, PluginInitFn, PluginOnCommandFn, PluginOnEventFn};
use crate::plugin_system::host::{self, HostContext};
use crate::plugin_system::manifest::{PluginInfo, PluginManifest};
use crate::plugin_system::permissions;
use crate::storage::database::Database;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

#[allow(dead_code)]
struct LoadedPlugin {
    manifest: PluginManifest,
    _library: libloading::Library,
    host_ctx: *mut HostContext,
    vtable: *mut HostVTable,
    on_event: Option<PluginOnEventFn>,
    on_command: Option<PluginOnCommandFn>,
    destroy: Option<PluginDestroyFn>,
    free_string: Option<PluginFreeStringFn>,
}

unsafe impl Send for LoadedPlugin {}

pub struct PluginManager {
    plugins: HashMap<String, LoadedPlugin>,
    manifests: HashMap<String, PluginManifest>,
    plugin_dir: PathBuf,
    db: Arc<Database>,
    app_handle: Option<tauri::AppHandle>,
}

impl PluginManager {
    pub fn new(plugin_dir: PathBuf, db: Arc<Database>) -> Self {
        let _ = std::fs::create_dir_all(&plugin_dir);
        Self {
            plugins: HashMap::new(),
            manifests: HashMap::new(),
            plugin_dir,
            db,
            app_handle: None,
        }
    }

    pub fn set_app_handle(&mut self, handle: tauri::AppHandle) {
        self.app_handle = Some(handle);
    }

    pub fn scan(&mut self) -> Vec<PluginManifest> {
        self.manifests.clear();
        let entries = match std::fs::read_dir(&self.plugin_dir) {
            Ok(e) => e,
            Err(_) => return Vec::new(),
        };
        let mut result = Vec::new();
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            match PluginManifest::load_from_dir(&path) {
                Ok(manifest) => {
                    self.manifests.insert(manifest.id.clone(), manifest.clone());
                    result.push(manifest);
                }
                Err(e) => {
                    log::warn!("Failed to load plugin from {}: {}", path.display(), e);
                }
            }
        }
        result
    }

    pub fn load(&mut self, plugin_id: &str) -> Result<(), String> {
        if self.plugins.contains_key(plugin_id) {
            return Ok(());
        }

        let manifest = self.manifests.get(plugin_id)
            .ok_or_else(|| format!("Plugin '{}' not found in scanned manifests", plugin_id))?
            .clone();

        let plugin_dir = self.plugin_dir.join(&manifest.id);
        let lib_path = manifest.library_path(&plugin_dir)
            .ok_or_else(|| format!("Plugin '{}' has no backend library", plugin_id))?;

        if !lib_path.exists() {
            return Err(format!("Library not found: {}", lib_path.display()));
        }

        let granted = permissions::load_granted_permissions(&self.db, plugin_id);
        if granted.is_empty() && !manifest.permissions.is_empty() {
            permissions::grant_all_declared(&self.db, plugin_id, &manifest.permissions);
        }

        let host_ctx = Box::new(HostContext {
            plugin_id: plugin_id.to_string(),
            db: self.db.clone(),
            declared_permissions: manifest.permissions.clone(),
            registered_commands: Mutex::new(Vec::new()),
            app_handle: self.app_handle.clone(),
        });
        let host_ctx_ptr = Box::into_raw(host_ctx);

        let vtable = Box::new(host::build_vtable(host_ctx_ptr as *mut std::ffi::c_void));
        let vtable_ptr = Box::into_raw(vtable);

        let library = unsafe { libloading::Library::new(&lib_path) }
            .map_err(|e| {
                unsafe {
                    drop(Box::from_raw(host_ctx_ptr));
                    drop(Box::from_raw(vtable_ptr));
                }
                format!("Failed to load library '{}': {}", lib_path.display(), e)
            })?;

        let init_fn: PluginInitFn = unsafe {
            *library.get::<PluginInitFn>(b"plugin_init")
                .map_err(|e| {
                    drop(Box::from_raw(host_ctx_ptr));
                    drop(Box::from_raw(vtable_ptr));
                    format!("Symbol 'plugin_init' not found: {}", e)
                })?
        };

        let on_event: Option<PluginOnEventFn> = unsafe {
            library.get::<PluginOnEventFn>(b"plugin_on_event").ok().map(|s| *s)
        };
        let on_command: Option<PluginOnCommandFn> = unsafe {
            library.get::<PluginOnCommandFn>(b"plugin_on_command").ok().map(|s| *s)
        };
        let destroy: Option<PluginDestroyFn> = unsafe {
            library.get::<PluginDestroyFn>(b"plugin_destroy").ok().map(|s| *s)
        };
        let free_string: Option<PluginFreeStringFn> = unsafe {
            library.get::<PluginFreeStringFn>(b"plugin_free_string").ok().map(|s| *s)
        };

        let ret = unsafe { init_fn(vtable_ptr as *const HostVTable) };
        if ret != 0 {
            unsafe {
                drop(Box::from_raw(host_ctx_ptr));
                drop(Box::from_raw(vtable_ptr));
            }
            return Err(format!("plugin_init returned error code {}", ret));
        }

        let _ = self.db.set_setting(&format!("plugin_enabled:{}", plugin_id), "true");

        self.plugins.insert(plugin_id.to_string(), LoadedPlugin {
            manifest,
            _library: library,
            host_ctx: host_ctx_ptr,
            vtable: vtable_ptr,
            on_event,
            on_command,
            destroy,
            free_string,
        });

        log::info!("Plugin '{}' loaded", plugin_id);
        Ok(())
    }

    pub fn unload(&mut self, plugin_id: &str) -> Result<(), String> {
        if let Some(plugin) = self.plugins.remove(plugin_id) {
            if let Some(destroy_fn) = plugin.destroy {
                unsafe { destroy_fn() };
            }
            unsafe {
                drop(Box::from_raw(plugin.host_ctx));
                drop(Box::from_raw(plugin.vtable));
            }
            log::info!("Plugin '{}' unloaded", plugin_id);
        }
        Ok(())
    }

    #[allow(dead_code)]
    pub fn broadcast_event(&self, event: &str, payload: &str) -> Vec<String> {
        let mut responses = Vec::new();
        let event_c = ffi::str_to_c(event);
        let payload_c = ffi::str_to_c(payload);

        for (id, plugin) in &self.plugins {
            if let Some(on_event) = plugin.on_event {
                let result_ptr = unsafe { on_event(event_c.as_ptr(), payload_c.as_ptr()) };
                if !result_ptr.is_null() {
                    let result = unsafe { ffi::c_to_string(result_ptr) };
                    if let Some(free_fn) = plugin.free_string {
                        unsafe { free_fn(result_ptr) };
                    }
                    responses.push(format!("{}:{}", id, result));
                }
            }
        }
        responses
    }

    pub fn call_command(&self, plugin_id: &str, command: &str, args: &str) -> Result<String, String> {
        let plugin = self.plugins.get(plugin_id)
            .ok_or_else(|| format!("Plugin '{}' is not loaded", plugin_id))?;

        let on_command = plugin.on_command
            .ok_or_else(|| format!("Plugin '{}' does not support commands", plugin_id))?;

        let cmd_c = ffi::str_to_c(command);
        let args_c = ffi::str_to_c(args);

        let result_ptr = unsafe { on_command(cmd_c.as_ptr(), args_c.as_ptr()) };
        if result_ptr.is_null() {
            return Ok("null".to_string());
        }
        let result = unsafe { ffi::c_to_string(result_ptr) };
        if let Some(free_fn) = plugin.free_string {
            unsafe { free_fn(result_ptr) };
        }
        Ok(result)
    }

    pub fn list_plugins(&self) -> Vec<PluginInfo> {
        self.manifests.values().map(|m| {
            let plugin_dir = self.plugin_dir.join(&m.id);
            let enabled = self.db.get_setting(&format!("plugin_enabled:{}", m.id))
                .unwrap_or(None)
                .map(|v| v == "true")
                .unwrap_or(false);
            let frontend_entry_path = m.frontend_entry_path(&plugin_dir)
                .map(|p| p.to_string_lossy().into_owned());

            PluginInfo {
                id: m.id.clone(),
                name: m.name.clone(),
                version: m.version.clone(),
                description: m.description.clone(),
                author: m.author.clone(),
                homepage: m.homepage.clone(),
                icon: m.icon.clone(),
                enabled,
                has_backend: m.backend.is_some(),
                has_frontend: m.frontend.is_some(),
                frontend_entry_path,
                plugin_dir_path: plugin_dir.to_string_lossy().into_owned(),
                permissions: m.permissions.clone(),
                spotlight_modes: m.spotlight_modes.clone(),
                settings: m.settings.clone(),
            }
        }).collect()
    }

    pub fn remove_plugin(&mut self, plugin_id: &str) -> Result<(), String> {
        self.unload(plugin_id)?;
        permissions::revoke_all(&self.db, plugin_id);
        let _ = self.db.set_setting(&format!("plugin_enabled:{}", plugin_id), "false");

        let plugin_path = self.plugin_dir.join(plugin_id);
        if plugin_path.exists() {
            std::fs::remove_dir_all(&plugin_path)
                .map_err(|e| format!("Failed to remove plugin directory: {}", e))?;
        }
        self.manifests.remove(plugin_id);
        log::info!("Plugin '{}' removed", plugin_id);
        Ok(())
    }

    pub fn plugin_dir(&self) -> &Path {
        &self.plugin_dir
    }
}

impl Drop for PluginManager {
    fn drop(&mut self) {
        let ids: Vec<String> = self.plugins.keys().cloned().collect();
        for id in ids {
            let _ = self.unload(&id);
        }
    }
}
