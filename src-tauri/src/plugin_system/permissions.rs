use crate::storage::database::Database;
use std::collections::HashSet;

pub const VALID_PERMISSIONS: &[&str] = &[
    "clipboard:read",
    "clipboard:write",
    "settings:read",
    "settings:write",
    "http",
    "events",
    "commands",
    // Names documented in the plugin SDK (CONTRIBUTING.md). Only
    // `network:*` maps onto a host-enforced capability; filesystem and
    // shell access happen inside the plugin's own process and are
    // declarative only.
    "filesystem:read",
    "filesystem:write",
    "shell:execute",
    "network:request",
    "network:http",
    "notification:send",
];

/// Map a declared permission onto the capabilities the host enforces.
fn host_capabilities_for(perm: &str) -> &'static [&'static str] {
    match perm {
        "network:request" | "network:http" => &["http"],
        _ => &[],
    }
}

pub fn load_granted_permissions(db: &Database, plugin_id: &str) -> HashSet<String> {
    let key = format!("plugin_permissions:{}", plugin_id);
    match db.get_setting(&key) {
        Ok(Some(json)) => serde_json::from_str(&json).unwrap_or_default(),
        _ => HashSet::new(),
    }
}

pub fn save_granted_permissions(db: &Database, plugin_id: &str, perms: &HashSet<String>) {
    let key = format!("plugin_permissions:{}", plugin_id);
    if let Ok(json) = serde_json::to_string(perms) {
        let _ = db.set_setting(&key, &json);
    }
}

pub fn grant_all_declared(db: &Database, plugin_id: &str, declared: &[String]) {
    let mut perms: HashSet<String> = declared
        .iter()
        .filter(|p| VALID_PERMISSIONS.contains(&p.as_str()))
        .cloned()
        .collect();

    // The host vtable always exposes the plugin's own settings namespace and
    // the system clipboard; existing plugin manifests don't declare these,
    // so grant them implicitly or every backend plugin loses its settings.
    for perm in ["settings:read", "settings:write", "clipboard:read", "clipboard:write"] {
        perms.insert(perm.to_string());
    }
    for perm in declared {
        for cap in host_capabilities_for(perm) {
            perms.insert(cap.to_string());
        }
    }

    save_granted_permissions(db, plugin_id, &perms);
}

pub fn check_permission(db: &Database, plugin_id: &str, perm: &str) -> bool {
    let granted = load_granted_permissions(db, plugin_id);
    granted.contains(perm)
}

pub fn revoke_all(db: &Database, plugin_id: &str) {
    let key = format!("plugin_permissions:{}", plugin_id);
    let _ = db.set_setting(&key, "[]");
}
