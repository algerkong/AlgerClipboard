use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub const CURRENT_API_VERSION: &str = "1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub homepage: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default = "default_api_version")]
    pub api_version: String,
    pub frontend: Option<PluginFrontend>,
    pub backend: Option<PluginBackend>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub spotlight_modes: Vec<SpotlightModeDecl>,
    #[serde(default)]
    pub hooks: Vec<String>,
    #[serde(default)]
    pub settings: HashMap<String, PluginSettingDef>,
}

fn default_api_version() -> String {
    CURRENT_API_VERSION.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginFrontend {
    pub entry: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginBackend {
    pub library: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpotlightModeDecl {
    pub id: String,
    pub prefix: String,
    #[serde(default)]
    pub shortcut_setting_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginSettingDef {
    pub setting_type: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub secret: bool,
    pub default: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub homepage: String,
    pub icon: String,
    pub enabled: bool,
    pub has_backend: bool,
    pub has_frontend: bool,
    pub frontend_entry_path: Option<String>,
    pub plugin_dir_path: String,
    pub permissions: Vec<String>,
    pub spotlight_modes: Vec<SpotlightModeDecl>,
    pub settings: HashMap<String, PluginSettingDef>,
}

impl PluginManifest {
    pub fn load_from_dir(plugin_dir: &Path) -> Result<Self, String> {
        let manifest_path = plugin_dir.join("manifest.json");
        if !manifest_path.exists() {
            return Err(format!("manifest.json not found in {}", plugin_dir.display()));
        }
        let content = std::fs::read_to_string(&manifest_path)
            .map_err(|e| format!("Failed to read manifest.json: {}", e))?;
        let manifest: PluginManifest = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse manifest.json: {}", e))?;

        if manifest.id.is_empty() {
            return Err("Plugin id is empty".to_string());
        }
        if manifest.name.is_empty() {
            return Err("Plugin name is empty".to_string());
        }
        if manifest.api_version != CURRENT_API_VERSION {
            return Err(format!(
                "Unsupported api_version '{}', expected '{}'",
                manifest.api_version, CURRENT_API_VERSION
            ));
        }

        Ok(manifest)
    }

    pub fn library_path(&self, plugin_dir: &Path) -> Option<PathBuf> {
        let backend = self.backend.as_ref()?;
        let lib_name = &backend.library;

        #[cfg(target_os = "windows")]
        let filename = format!("{}.dll", lib_name);
        #[cfg(target_os = "macos")]
        let filename = format!("lib{}.dylib", lib_name);
        #[cfg(target_os = "linux")]
        let filename = format!("lib{}.so", lib_name);

        Some(plugin_dir.join(filename))
    }

    pub fn frontend_entry_path(&self, plugin_dir: &Path) -> Option<PathBuf> {
        let frontend = self.frontend.as_ref()?;
        Some(plugin_dir.join(&frontend.entry))
    }
}
