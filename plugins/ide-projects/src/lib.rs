use std::ffi::{CStr, CString, c_char, c_int, c_void};
use std::path::PathBuf;

#[repr(C)]
pub struct HostVTable {
    pub ctx: *mut c_void,
    pub get_setting: extern "C" fn(*mut c_void, *const c_char) -> *mut c_char,
    pub set_setting: extern "C" fn(*mut c_void, *const c_char, *const c_char) -> c_int,
    pub read_clipboard: extern "C" fn(*mut c_void) -> *mut c_char,
    pub write_clipboard: extern "C" fn(*mut c_void, *const c_char) -> c_int,
    pub http_request: extern "C" fn(*mut c_void, *const c_char, *const c_char, *const c_char, *const c_char) -> *mut c_char,
    pub emit_event: extern "C" fn(*mut c_void, *const c_char, *const c_char) -> c_int,
    pub register_command: extern "C" fn(*mut c_void, *const c_char) -> c_int,
    pub log: extern "C" fn(*mut c_void, c_int, *const c_char),
    pub free_string: extern "C" fn(*mut c_void, *mut c_char),
}

static mut HOST: *const HostVTable = std::ptr::null();

fn host_log(level: c_int, msg: &str) {
    unsafe {
        if !HOST.is_null() {
            if let Ok(cs) = CString::new(msg) {
                ((*HOST).log)((*HOST).ctx, level, cs.as_ptr());
            }
        }
    }
}

// ---- IDE definitions ----

#[derive(Clone, PartialEq)]
enum IdeKind { VsCodeFork, Zed, JetBrains }

#[derive(Clone)]
struct IdeInfo {
    id: &'static str,
    name: &'static str,
    dir_name: &'static str,
    cli: &'static str,
    kind: IdeKind,
}

// VS Code forks + Zed
const IDES: &[IdeInfo] = &[
    IdeInfo { id: "code", name: "VS Code", dir_name: "Code", cli: "code", kind: IdeKind::VsCodeFork },
    IdeInfo { id: "cursor", name: "Cursor", dir_name: "Cursor", cli: "cursor", kind: IdeKind::VsCodeFork },
    IdeInfo { id: "windsurf", name: "Windsurf", dir_name: "Windsurf", cli: "windsurf", kind: IdeKind::VsCodeFork },
    IdeInfo { id: "trae", name: "Trae", dir_name: "Trae", cli: "trae", kind: IdeKind::VsCodeFork },
    IdeInfo { id: "trae-cn", name: "Trae CN", dir_name: "Trae CN", cli: "trae", kind: IdeKind::VsCodeFork },
    IdeInfo { id: "antigravity", name: "Antigravity", dir_name: "Antigravity", cli: "antigravity", kind: IdeKind::VsCodeFork },
    IdeInfo { id: "zed", name: "Zed", dir_name: "Zed", cli: "zed", kind: IdeKind::Zed },
];

// JetBrains IDEs: dir_name is the prefix before the version number in %APPDATA%/JetBrains/
// e.g. "IntelliJIdea" matches "IntelliJIdea2025.1", "IntelliJIdea2024.3", etc.
struct JetBrainsIde {
    id: &'static str,
    name: &'static str,
    dir_prefix: &'static str,
    cli: &'static str,
}

const JETBRAINS_IDES: &[JetBrainsIde] = &[
    JetBrainsIde { id: "idea", name: "IntelliJ IDEA", dir_prefix: "IntelliJIdea", cli: "idea" },
    JetBrainsIde { id: "idea-ce", name: "IntelliJ IDEA CE", dir_prefix: "IdeaIC", cli: "idea" },
    JetBrainsIde { id: "pycharm", name: "PyCharm", dir_prefix: "PyCharm", cli: "pycharm" },
    JetBrainsIde { id: "pycharm-ce", name: "PyCharm CE", dir_prefix: "PyCharmCE", cli: "pycharm" },
    JetBrainsIde { id: "goland", name: "GoLand", dir_prefix: "GoLand", cli: "goland" },
    JetBrainsIde { id: "webstorm", name: "WebStorm", dir_prefix: "WebStorm", cli: "webstorm" },
    JetBrainsIde { id: "clion", name: "CLion", dir_prefix: "CLion", cli: "clion" },
    JetBrainsIde { id: "phpstorm", name: "PhpStorm", dir_prefix: "PhpStorm", cli: "phpstorm" },
    JetBrainsIde { id: "rustrover", name: "RustRover", dir_prefix: "RustRover", cli: "rustrover" },
    JetBrainsIde { id: "rider", name: "Rider", dir_prefix: "Rider", cli: "rider" },
    JetBrainsIde { id: "datagrip", name: "DataGrip", dir_prefix: "DataGrip", cli: "datagrip" },
    JetBrainsIde { id: "rubymine", name: "RubyMine", dir_prefix: "RubyMine", cli: "rubymine" },
    JetBrainsIde { id: "dataspell", name: "DataSpell", dir_prefix: "DataSpell", cli: "dataspell" },
    JetBrainsIde { id: "aqua", name: "Aqua", dir_prefix: "Aqua", cli: "aqua" },
    JetBrainsIde { id: "android-studio", name: "Android Studio", dir_prefix: "Google/AndroidStudio", cli: "studio" },
];

// ---- Platform paths ----

fn vscode_config_root(dir_name: &str) -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    { std::env::var("APPDATA").ok().map(|d| PathBuf::from(d).join(dir_name)) }
    #[cfg(target_os = "macos")]
    { home_dir().map(|h| h.join("Library/Application Support").join(dir_name)) }
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_CONFIG_HOME").ok().map(PathBuf::from)
            .or_else(|| home_dir().map(|h| h.join(".config")))
            .map(|d| d.join(dir_name))
    }
}

fn zed_data_root() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    { std::env::var("LOCALAPPDATA").ok().map(|d| PathBuf::from(d).join("Zed")) }
    #[cfg(target_os = "macos")]
    { home_dir().map(|h| h.join("Library/Application Support/Zed")) }
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_DATA_HOME").ok().map(PathBuf::from)
            .or_else(|| home_dir().map(|h| h.join(".local/share")))
            .map(|d| d.join("zed"))
    }
}

fn home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    { std::env::var("USERPROFILE").ok().map(PathBuf::from) }
    #[cfg(not(target_os = "windows"))]
    { std::env::var("HOME").ok().map(PathBuf::from) }
}

// ---- Project scanning ----

#[derive(serde::Serialize)]
struct ProjectEntry {
    name: String,
    /// For local: filesystem path. For remote: the path inside WSL/SSH.
    path: String,
    ide: String,
    ide_name: String,
    cli: String,
    exists: bool,
    /// For WSL remote projects: "wsl+Ubuntu" etc. None for local projects.
    #[serde(skip_serializing_if = "Option::is_none")]
    remote: Option<String>,
}

/// Parse a vscode-remote URI for WSL.
/// Input:  "vscode-remote://wsl%2Bubuntu/home/user/project"
/// Output: Some(("wsl+ubuntu", "/home/user/project"))
fn parse_vscode_remote_wsl(uri: &str) -> Option<(String, String)> {
    let rest = uri.strip_prefix("vscode-remote://")?;
    let slash_pos = rest.find('/')?;
    let authority = percent_decode(&rest[..slash_pos]); // "wsl+ubuntu"
    if !authority.starts_with("wsl+") {
        return None; // Skip SSH and other remotes for now
    }
    let path = format!("/{}", &rest[slash_pos + 1..]); // "/home/user/project"
    Some((authority, path))
}

/// Parse a file://wsl.localhost URI.
/// Input:  "file://wsl.localhost/Ubuntu/home/user/project"
/// Output: Some(("wsl+Ubuntu", "/home/user/project"))
fn parse_wsl_localhost_uri(uri: &str) -> Option<(String, String)> {
    let rest = uri.strip_prefix("file://wsl.localhost/")?;
    let slash_pos = rest.find('/')?;
    let distro = &rest[..slash_pos]; // "Ubuntu"
    let path = format!("/{}", &rest[slash_pos + 1..]); // "/home/user/project"
    Some((format!("wsl+{}", distro), path))
}

fn scan_vscode_fork(ide: &IdeInfo) -> Vec<ProjectEntry> {
    let root = match vscode_config_root(ide.dir_name) {
        Some(r) => r,
        None => return vec![],
    };
    let db_path = root.join("User/globalStorage/state.vscdb");
    if !db_path.exists() {
        return vec![];
    }

    let db = match rusqlite::Connection::open_with_flags(
        &db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    ) {
        Ok(db) => db,
        Err(e) => {
            host_log(3, &format!("Failed to open {}: {}", db_path.display(), e));
            return vec![];
        }
    };

    let json_str: String = match db.query_row(
        "SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'",
        [],
        |row| row.get(0),
    ) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let parsed: serde_json::Value = match serde_json::from_str(&json_str) {
        Ok(v) => v,
        Err(_) => return vec![],
    };

    let entries = match parsed.get("entries").and_then(|e| e.as_array()) {
        Some(arr) => arr,
        None => return vec![],
    };

    let mut results = Vec::new();
    for entry in entries {
        let uri = match entry.get("folderUri").and_then(|v| v.as_str()) {
            Some(u) => u,
            None => continue,
        };

        // 1) Local file:/// URI
        if uri.starts_with("file:///") {
            // Skip WSL localhost paths handled below
            if uri.starts_with("file://wsl.localhost/") {
                // Handled in case 3
            } else {
                let path = file_uri_to_path(uri);
                if path.is_empty() { continue; }
                let name = path_last_component(&path);
                let exists = std::path::Path::new(&path).exists();
                results.push(ProjectEntry {
                    name, path, ide: ide.id.into(), ide_name: ide.name.into(),
                    cli: ide.cli.into(), exists, remote: None,
                });
                continue;
            }
        }

        // 2) vscode-remote://wsl%2Bubuntu/... URI
        if uri.starts_with("vscode-remote://") {
            if let Some((authority, remote_path)) = parse_vscode_remote_wsl(uri) {
                let name = path_last_component(&remote_path);
                results.push(ProjectEntry {
                    name, path: remote_path, ide: ide.id.into(), ide_name: ide.name.into(),
                    cli: ide.cli.into(), exists: true, remote: Some(authority),
                });
            }
            continue;
        }

        // 3) file://wsl.localhost/Ubuntu/... URI
        if uri.starts_with("file://wsl.localhost/") {
            if let Some((authority, remote_path)) = parse_wsl_localhost_uri(uri) {
                let name = path_last_component(&remote_path);
                results.push(ProjectEntry {
                    name, path: remote_path, ide: ide.id.into(), ide_name: ide.name.into(),
                    cli: ide.cli.into(), exists: true, remote: Some(authority),
                });
            }
            continue;
        }
    }

    results
}

fn scan_zed() -> Vec<ProjectEntry> {
    // Zed on Windows uses LOCALAPPDATA, on macOS/Linux uses standard paths
    // Also try APPDATA as fallback
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Some(r) = zed_data_root() { roots.push(r); }
    #[cfg(target_os = "windows")]
    {
        // Also try APPDATA/Zed as some installations use it
        if let Ok(appdata) = std::env::var("APPDATA") {
            let alt = PathBuf::from(appdata).join("Zed");
            if !roots.contains(&alt) { roots.push(alt); }
        }
    }

    let mut all_results = Vec::new();
    for root in &roots {
        for candidate in &["0-stable", "0-dev"] {
            let db_path = root.join("db").join(candidate).join("db.sqlite");
            if !db_path.exists() { continue; }

            let db = match rusqlite::Connection::open_with_flags(
                &db_path,
                rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
            ) {
                Ok(db) => db,
                Err(_) => continue,
            };

            // New schema: `paths` column is a plain text string
            if let Ok(mut stmt) = db.prepare(
                "SELECT paths FROM workspaces WHERE paths IS NOT NULL AND paths != '' ORDER BY timestamp DESC"
            ) {
                if let Ok(rows) = stmt.query_map([], |row| {
                    let p: String = row.get(0)?;
                    Ok(p)
                }) {
                    for row in rows.flatten() {
                        let path = row.trim().to_string();
                        if path.is_empty() { continue; }
                        let name = path_last_component(&path);
                        let exists = std::path::Path::new(&path).exists();
                        if !all_results.iter().any(|e: &ProjectEntry| e.path == path) {
                            all_results.push(ProjectEntry {
                                name, path, ide: "zed".into(), ide_name: "Zed".into(),
                                cli: "zed".into(), exists, remote: None,
                            });
                        }
                    }
                }
            }

            // Old schema fallback: `local_paths` column is BLOB
            if all_results.is_empty() {
                if let Ok(mut stmt) = db.prepare(
                    "SELECT local_paths FROM workspaces WHERE local_paths IS NOT NULL ORDER BY timestamp DESC"
                ) {
                    if let Ok(rows) = stmt.query_map([], |row| { let b: Vec<u8> = row.get(0)?; Ok(b) }) {
                        for row in rows.flatten() {
                            if let Some(path) = parse_zed_local_paths(&row) {
                                let name = path_last_component(&path);
                                let exists = std::path::Path::new(&path).exists();
                                all_results.push(ProjectEntry {
                                    name, path, ide: "zed".into(), ide_name: "Zed".into(),
                                    cli: "zed".into(), exists, remote: None,
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    all_results
}

fn parse_zed_local_paths(blob: &[u8]) -> Option<String> {
    if blob.len() < 16 { return None; }
    let count = u64::from_le_bytes(blob[0..8].try_into().ok()?);
    if count == 0 { return None; }
    let path_len = u64::from_le_bytes(blob[8..16].try_into().ok()?) as usize;
    if blob.len() < 16 + path_len { return None; }
    String::from_utf8(blob[16..16 + path_len].to_vec()).ok()
}

fn file_uri_to_path(uri: &str) -> String {
    let stripped = uri.strip_prefix("file:///").unwrap_or(uri);
    let decoded = percent_decode(stripped);
    #[cfg(not(target_os = "windows"))]
    { format!("/{}", decoded) }
    #[cfg(target_os = "windows")]
    { decoded.replace('/', "\\") }
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut result = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(byte) = u8::from_str_radix(
                std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or(""), 16,
            ) {
                result.push(byte);
                i += 3;
                continue;
            }
        }
        result.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(result).unwrap_or_else(|_| s.to_string())
}

fn path_last_component(path: &str) -> String {
    let p = path.replace('\\', "/");
    p.rsplit('/').find(|s| !s.is_empty()).unwrap_or(path).to_string()
}

// ---- JetBrains project scanning ----

fn jetbrains_config_root() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    { std::env::var("APPDATA").ok().map(|d| PathBuf::from(d).join("JetBrains")) }
    #[cfg(target_os = "macos")]
    { home_dir().map(|h| h.join("Library/Application Support/JetBrains")) }
    #[cfg(target_os = "linux")]
    {
        std::env::var("XDG_CONFIG_HOME").ok().map(PathBuf::from)
            .or_else(|| home_dir().map(|h| h.join(".config")))
            .map(|d| d.join("JetBrains"))
    }
}

fn scan_jetbrains_ide(ide: &JetBrainsIde) -> Vec<ProjectEntry> {
    let root = match jetbrains_config_root() {
        Some(r) => r,
        None => return vec![],
    };
    if !root.exists() { return vec![]; }

    // Find the latest version directory matching the prefix
    // e.g. "IntelliJIdea2025.1", "IntelliJIdea2024.3"
    // For Android Studio: prefix is "Google/AndroidStudio" so we handle nested path
    let (search_dir, prefix) = if ide.dir_prefix.contains('/') {
        let parts: Vec<&str> = ide.dir_prefix.rsplitn(2, '/').collect();
        (root.join(parts[1]), parts[0].to_string())
    } else {
        (root.clone(), ide.dir_prefix.to_string())
    };

    let mut version_dirs: Vec<PathBuf> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&search_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with(&prefix) && entry.path().is_dir() {
                version_dirs.push(entry.path());
            }
        }
    }

    // Sort by name descending to prefer latest version
    version_dirs.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

    let mut results = Vec::new();
    let mut seen_paths = std::collections::HashSet::new();

    for dir in version_dirs {
        // Rider uses recentSolutions.xml, others use recentProjects.xml
        let xml_name = if ide.id == "rider" { "recentSolutions.xml" } else { "recentProjects.xml" };
        let xml_path = dir.join("options").join(xml_name);
        if !xml_path.exists() { continue; }

        let content = match std::fs::read_to_string(&xml_path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        parse_jetbrains_recent_xml(&content, ide, &mut results, &mut seen_paths);
    }

    results
}

fn parse_jetbrains_recent_xml(
    content: &str,
    ide: &JetBrainsIde,
    results: &mut Vec<ProjectEntry>,
    seen: &mut std::collections::HashSet<String>,
) {
    // Parse entry keys from: <entry key="$USER_HOME$/path"> or <entry key="//wsl.localhost/...">
    // The key uses $USER_HOME$ as placeholder for home directory
    let home = home_dir().unwrap_or_default();
    let home_str = home.to_string_lossy().replace('\\', "/");

    for line in content.lines() {
        let line = line.trim();
        if !line.starts_with("<entry key=\"") { continue; }

        let key_start = match line.find("key=\"") {
            Some(pos) => pos + 5,
            None => continue,
        };
        let key_end = match line[key_start..].find('"') {
            Some(pos) => key_start + pos,
            None => continue,
        };
        let raw_path = &line[key_start..key_end];

        // Replace $USER_HOME$ with actual home
        let resolved = raw_path.replace("$USER_HOME$", &home_str);

        // Handle WSL paths: //wsl.localhost/Ubuntu/home/user/project
        let (path, remote) = if resolved.starts_with("//wsl.localhost/") || resolved.starts_with("//wsl$/") {
            let rest = resolved.trim_start_matches("//wsl.localhost/").trim_start_matches("//wsl$/");
            if let Some(slash_pos) = rest.find('/') {
                let distro = &rest[..slash_pos];
                let remote_path = format!("/{}", &rest[slash_pos + 1..]);
                (remote_path, Some(format!("wsl+{}", distro)))
            } else {
                continue;
            }
        } else {
            // Convert forward slashes to platform path
            #[cfg(target_os = "windows")]
            let path = resolved.replace('/', "\\");
            #[cfg(not(target_os = "windows"))]
            let path = if resolved.starts_with('/') { resolved.clone() } else { format!("/{}", resolved) };
            (path, None)
        };

        if path.is_empty() || !seen.insert(format!("{}|{}", path, remote.as_deref().unwrap_or(""))) {
            continue;
        }

        let name = path_last_component(&path);
        let exists = if remote.is_some() { true } else { std::path::Path::new(&path).exists() };

        results.push(ProjectEntry {
            name,
            path,
            ide: ide.id.into(),
            ide_name: ide.name.into(),
            cli: ide.cli.into(),
            exists,
            remote,
        });
    }
}

fn scan_all_ides() -> Vec<ProjectEntry> {
    let mut all = Vec::new();
    for ide in IDES {
        if ide.kind == IdeKind::VsCodeFork {
            all.extend(scan_vscode_fork(ide));
        }
    }
    all.extend(scan_zed());

    // Scan JetBrains IDEs
    for ide in JETBRAINS_IDES {
        all.extend(scan_jetbrains_ide(ide));
    }

    // Deduplicate by (path + remote) combination
    let mut seen = std::collections::HashSet::new();
    all.retain(|e| {
        let key = format!("{}|{}", e.path, e.remote.as_deref().unwrap_or(""));
        seen.insert(key)
    });
    all
}

fn open_project(ide_cli: &str, path: &str, remote: Option<&str>) -> Result<(), String> {
    let mut args: Vec<&str> = Vec::new();

    // For WSL remote projects: code --remote wsl+Ubuntu /path
    if let Some(authority) = remote {
        args.push("--remote");
        args.push(authority);
    }
    args.push(path);

    #[cfg(target_os = "windows")]
    {
        let mut cmd_args = vec!["/c", ide_cli];
        cmd_args.extend(&args);
        std::process::Command::new("cmd")
            .args(&cmd_args)
            .spawn()
            .map_err(|e| format!("Failed to launch {} {:?}: {}", ide_cli, args, e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new(ide_cli)
            .args(&args)
            .spawn()
            .map_err(|e| format!("Failed to launch {} {:?}: {}", ide_cli, args, e))?;
    }
    Ok(())
}

// ---- Plugin C ABI exports ----

#[no_mangle]
pub extern "C" fn plugin_init(host: *const HostVTable) -> c_int {
    unsafe { HOST = host; }
    let cmds = ["scan", "open"];
    for cmd in &cmds {
        if let Ok(cs) = CString::new(*cmd) {
            unsafe { ((*HOST).register_command)((*HOST).ctx, cs.as_ptr()); }
        }
    }
    host_log(2, "IDE Projects plugin initialized");
    0
}

#[no_mangle]
pub extern "C" fn plugin_on_command(command: *const c_char, args: *const c_char) -> *mut c_char {
    let cmd = unsafe { CStr::from_ptr(command) }.to_str().unwrap_or("");
    let args_str = unsafe { CStr::from_ptr(args) }.to_str().unwrap_or("{}");

    let result = match cmd {
        "scan" => {
            let projects = scan_all_ides();
            serde_json::to_string(&projects).unwrap_or_else(|_| "[]".to_string())
        }
        "open" => {
            let parsed: serde_json::Value = serde_json::from_str(args_str).unwrap_or_default();
            let cli = parsed.get("cli").and_then(|v| v.as_str()).unwrap_or("code");
            let path = parsed.get("path").and_then(|v| v.as_str()).unwrap_or("");
            let remote = parsed.get("remote").and_then(|v| v.as_str());

            match open_project(cli, path, remote) {
                Ok(_) => r#"{"ok":true}"#.to_string(),
                Err(e) => format!(r#"{{"ok":false,"error":"{}"}}"#, e.replace('"', "\\\""))
            }
        }
        _ => r#"{"error":"unknown command"}"#.to_string(),
    };

    CString::new(result).map(|cs| cs.into_raw()).unwrap_or(std::ptr::null_mut())
}

#[no_mangle]
pub extern "C" fn plugin_on_event(_: *const c_char, _: *const c_char) -> *mut c_char {
    std::ptr::null_mut()
}

#[no_mangle]
pub extern "C" fn plugin_destroy() {
    host_log(2, "IDE Projects plugin destroyed");
}

#[no_mangle]
pub extern "C" fn plugin_free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe { drop(CString::from_raw(s)); }
    }
}
