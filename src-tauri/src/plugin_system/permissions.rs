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
];

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
    let perms: HashSet<String> = declared
        .iter()
        .filter(|p| VALID_PERMISSIONS.contains(&p.as_str()))
        .cloned()
        .collect();
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
