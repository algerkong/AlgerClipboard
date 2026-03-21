pub mod icon;
pub mod launcher;
pub mod scanner;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppEntry {
    pub id: String,
    pub name: String,
    pub path: String,
    pub icon_base64: Option<String>,
    pub source: AppSource,
    pub launch_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppSource {
    System,
    Custom,
}
