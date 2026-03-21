use super::icon::IconExtractor;
use super::{AppEntry, AppSource};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

pub struct AppScanner {
    cache: Arc<Mutex<Vec<AppEntry>>>,
    icon_extractor: Option<IconExtractor>,
}

impl AppScanner {
    pub fn new() -> Self {
        // Initialize icon extractor with cache dir
        let icon_extractor = directories::ProjectDirs::from("com", "alger", "clipboard")
            .map(|dirs| {
                let cache_dir = dirs.cache_dir().join("app_icons");
                IconExtractor::new(cache_dir)
            });

        Self {
            cache: Arc::new(Mutex::new(Vec::new())),
            icon_extractor,
        }
    }

    /// Scan system applications and cache the results in memory.
    pub fn scan(&self) -> Result<Vec<AppEntry>, String> {
        let mut apps = self.scan_platform()?;

        // Extract icons for each app
        if let Some(ref extractor) = self.icon_extractor {
            for app in &mut apps {
                if app.icon_base64.is_none() {
                    app.icon_base64 = extractor.extract_icon(&app.path);
                }
            }
        }

        let mut cache = self.cache.lock().map_err(|e| e.to_string())?;
        *cache = apps.clone();
        Ok(apps)
    }

    /// Fuzzy search the cached application list.
    pub fn search(&self, keyword: &str) -> Result<Vec<AppEntry>, String> {
        {
            let cache = self.cache.lock().map_err(|e| e.to_string())?;
            if cache.is_empty() {
                drop(cache);
                self.scan()?;
            }
        }
        let cache = self.cache.lock().map_err(|e| e.to_string())?;
        Ok(Self::filter_apps(&cache, keyword))
    }

    /// Get all cached apps (for empty query — show most used).
    pub fn get_all(&self) -> Result<Vec<AppEntry>, String> {
        {
            let cache = self.cache.lock().map_err(|e| e.to_string())?;
            if cache.is_empty() {
                drop(cache);
                self.scan()?;
            }
        }
        let cache = self.cache.lock().map_err(|e| e.to_string())?;
        let mut apps = cache.clone();
        apps.sort_by(|a, b| b.launch_count.cmp(&a.launch_count));
        Ok(apps)
    }

    fn filter_apps(apps: &[AppEntry], keyword: &str) -> Vec<AppEntry> {
        if keyword.is_empty() {
            let mut all = apps.to_vec();
            all.sort_by(|a, b| b.launch_count.cmp(&a.launch_count));
            return all;
        }

        let kw = keyword.to_lowercase();
        let mut results: Vec<AppEntry> = apps
            .iter()
            .filter(|app| {
                app.name.to_lowercase().contains(&kw)
                    || app.path.to_lowercase().contains(&kw)
            })
            .cloned()
            .collect();
        results.sort_by(|a, b| b.launch_count.cmp(&a.launch_count));
        results
    }

    #[cfg(target_os = "windows")]
    fn scan_platform(&self) -> Result<Vec<AppEntry>, String> {
        let mut apps = Vec::new();
        let mut seen_paths = HashSet::new();

        let mut dirs_to_scan: Vec<PathBuf> = Vec::new();

        // Start Menu (common for all users)
        if let Ok(program_data) = std::env::var("ProgramData") {
            dirs_to_scan.push(
                PathBuf::from(&program_data)
                    .join("Microsoft")
                    .join("Windows")
                    .join("Start Menu")
                    .join("Programs"),
            );
        }

        // Start Menu (current user)
        if let Ok(appdata) = std::env::var("APPDATA") {
            dirs_to_scan.push(
                PathBuf::from(&appdata)
                    .join("Microsoft")
                    .join("Windows")
                    .join("Start Menu")
                    .join("Programs"),
            );
        }

        // Desktop (current user)
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            dirs_to_scan.push(PathBuf::from(&userprofile).join("Desktop"));
        }

        // Desktop (public)
        if let Ok(public) = std::env::var("PUBLIC") {
            dirs_to_scan.push(PathBuf::from(&public).join("Desktop"));
        }

        for dir in &dirs_to_scan {
            if dir.exists() {
                self.scan_lnk_dir(dir, &mut apps, &mut seen_paths);
            }
        }

        Ok(apps)
    }

    #[cfg(target_os = "windows")]
    fn scan_lnk_dir(
        &self,
        dir: &Path,
        apps: &mut Vec<AppEntry>,
        seen_paths: &mut HashSet<String>,
    ) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                self.scan_lnk_dir(&path, apps, seen_paths);
                continue;
            }

            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext.eq_ignore_ascii_case("lnk") {
                if let Some(app) = self.parse_lnk_file(&path, seen_paths) {
                    apps.push(app);
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    fn parse_lnk_file(
        &self,
        lnk_path: &Path,
        seen_paths: &mut HashSet<String>,
    ) -> Option<AppEntry> {
        let shell_link =
            lnk::ShellLink::open(lnk_path, lnk::encoding::WINDOWS_1252).ok()?;

        // Get target path
        let target = shell_link.link_target()?;

        // Only include executable files
        let target_lower = target.to_lowercase();
        if !target_lower.ends_with(".exe") {
            return None;
        }

        // Skip uninstallers and updaters
        let name_lower = lnk_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        if name_lower.contains("uninstall")
            || name_lower.contains("卸载")
            || name_lower.contains("update")
            || name_lower.contains("updater")
        {
            return None;
        }

        // Deduplicate by target path
        let target_key = target_lower.clone();
        if seen_paths.contains(&target_key) {
            return None;
        }
        seen_paths.insert(target_key);

        let name = lnk_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let id = uuid::Uuid::new_v4().to_string();

        Some(AppEntry {
            id,
            name,
            path: target,
            icon_base64: None,
            source: AppSource::System,
            launch_count: 0,
        })
    }

    #[cfg(target_os = "macos")]
    fn scan_platform(&self) -> Result<Vec<AppEntry>, String> {
        let mut apps = Vec::new();
        let mut seen_paths = HashSet::new();

        let home = std::env::var("HOME").unwrap_or_default();
        let dirs = [
            PathBuf::from("/Applications"),
            PathBuf::from("/System/Applications"),
            PathBuf::from(&home).join("Applications"),
        ];

        for dir in &dirs {
            if dir.exists() {
                self.scan_app_dir(dir, &mut apps, &mut seen_paths);
            }
        }

        Ok(apps)
    }

    #[cfg(target_os = "macos")]
    fn scan_app_dir(
        &self,
        dir: &Path,
        apps: &mut Vec<AppEntry>,
        seen_paths: &mut HashSet<String>,
    ) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext == "app" {
                let path_str = path.to_string_lossy().to_string();
                if seen_paths.contains(&path_str) {
                    continue;
                }
                seen_paths.insert(path_str.clone());

                let name = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Unknown")
                    .to_string();

                apps.push(AppEntry {
                    id: uuid::Uuid::new_v4().to_string(),
                    name,
                    path: path_str,
                    icon_base64: None,
                    source: AppSource::System,
                    launch_count: 0,
                });
            }
        }
    }

    #[cfg(target_os = "linux")]
    fn scan_platform(&self) -> Result<Vec<AppEntry>, String> {
        let mut apps = Vec::new();
        let mut seen_names = HashSet::new();

        let home = std::env::var("HOME").unwrap_or_default();
        let dirs = [
            PathBuf::from("/usr/share/applications"),
            PathBuf::from(&home).join(".local/share/applications"),
        ];

        for dir in &dirs {
            if dir.exists() {
                self.scan_desktop_dir(dir, &mut apps, &mut seen_names);
            }
        }

        Ok(apps)
    }

    #[cfg(target_os = "linux")]
    fn scan_desktop_dir(
        &self,
        dir: &Path,
        apps: &mut Vec<AppEntry>,
        seen_names: &mut HashSet<String>,
    ) {
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext != "desktop" {
                continue;
            }

            if let Ok(content) = std::fs::read_to_string(&path) {
                let mut name = None;
                let mut exec = None;
                let mut no_display = false;
                let mut hidden = false;

                for line in content.lines() {
                    let line = line.trim();
                    if line.starts_with("Name=") && name.is_none() {
                        name = Some(line[5..].to_string());
                    } else if line.starts_with("Exec=") && exec.is_none() {
                        let raw = &line[5..];
                        let cleaned = raw
                            .split_whitespace()
                            .take_while(|s| !s.starts_with('%'))
                            .collect::<Vec<_>>()
                            .join(" ");
                        exec = Some(cleaned);
                    } else if line == "NoDisplay=true" {
                        no_display = true;
                    } else if line == "Hidden=true" {
                        hidden = true;
                    }
                }

                if no_display || hidden {
                    continue;
                }

                if let (Some(name), Some(exec)) = (name, exec) {
                    if seen_names.contains(&name) {
                        continue;
                    }
                    seen_names.insert(name.clone());

                    apps.push(AppEntry {
                        id: uuid::Uuid::new_v4().to_string(),
                        name,
                        path: exec,
                        icon_base64: None,
                        source: AppSource::System,
                        launch_count: 0,
                    });
                }
            }
        }
    }
}
