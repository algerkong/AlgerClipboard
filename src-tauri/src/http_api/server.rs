use crate::storage::blob::BlobStore;
use crate::storage::database::Database;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

pub const DEFAULT_PORT: u16 = 25483;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpApiConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub allow_write: bool,
}

fn default_port() -> u16 {
    DEFAULT_PORT
}

impl Default for HttpApiConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            port: DEFAULT_PORT,
            api_key: String::new(),
            allow_write: false,
        }
    }
}

impl HttpApiConfig {
    pub fn load(db: &Database) -> Self {
        let enabled = db
            .get_setting("http_api_enabled")
            .ok()
            .flatten()
            .map(|value| value == "true")
            .unwrap_or(false);
        let port = db
            .get_setting("http_api_port")
            .ok()
            .flatten()
            .and_then(|value| value.parse::<u16>().ok())
            .filter(|port| *port > 0)
            .unwrap_or(DEFAULT_PORT);
        let api_key = db
            .get_setting("http_api_key")
            .ok()
            .flatten()
            .unwrap_or_default();
        let allow_write = db
            .get_setting("http_api_allow_write")
            .ok()
            .flatten()
            .map(|value| value == "true")
            .unwrap_or(false);

        Self {
            enabled,
            port,
            api_key,
            allow_write,
        }
    }

    pub fn save(&self, db: &Database) -> Result<(), String> {
        db.set_setting("http_api_enabled", if self.enabled { "true" } else { "false" })?;
        db.set_setting("http_api_port", &self.port.to_string())?;
        db.set_setting("http_api_key", &self.api_key)?;
        db.set_setting(
            "http_api_allow_write",
            if self.allow_write { "true" } else { "false" },
        )?;
        Ok(())
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct HttpApiStatus {
    pub enabled: bool,
    pub running: bool,
    pub port: u16,
    pub api_key: String,
    pub allow_write: bool,
    pub error: Option<String>,
}

struct RunningServer {
    handle: tokio::task::JoinHandle<()>,
}

pub struct HttpApiManager {
    server: Mutex<Option<RunningServer>>,
    status: Mutex<HttpApiStatus>,
}

impl HttpApiManager {
    pub fn new() -> Self {
        Self {
            server: Mutex::new(None),
            status: Mutex::new(HttpApiStatus {
                enabled: false,
                running: false,
                port: DEFAULT_PORT,
                api_key: String::new(),
                allow_write: false,
                error: None,
            }),
        }
    }

    pub fn status(&self) -> HttpApiStatus {
        let running = self
            .server
            .lock()
            .ok()
            .and_then(|guard| {
                guard.as_ref().map(|server| !server.handle.is_finished())
            })
            .unwrap_or(false);

        let mut status = self
            .status
            .lock()
            .map(|status| status.clone())
            .unwrap_or_else(|_| HttpApiStatus {
                enabled: false,
                running: false,
                port: DEFAULT_PORT,
                api_key: String::new(),
                allow_write: false,
                error: None,
            });
        status.running = status.running && running;
        status
    }

    async fn stop_and_wait(&self) {
        let server = self.server.lock().ok().and_then(|mut guard| guard.take());
        if let Some(server) = server {
            server.handle.abort();
            let _ = server.handle.await;
        }
        if let Ok(mut status) = self.status.lock() {
            status.running = false;
        }
    }

    pub async fn apply_from_settings(
        &self,
        app: tauri::AppHandle,
        db: Arc<Database>,
        blob_store: Arc<BlobStore>,
    ) -> Result<HttpApiStatus, String> {
        let config = HttpApiConfig::load(&db);
        self.apply(app, db, blob_store, config).await
    }

    pub async fn apply(
        &self,
        app: tauri::AppHandle,
        db: Arc<Database>,
        blob_store: Arc<BlobStore>,
        config: HttpApiConfig,
    ) -> Result<HttpApiStatus, String> {
        self.stop_and_wait().await;

        if !config.enabled {
            let status = HttpApiStatus {
                enabled: false,
                running: false,
                port: config.port,
                api_key: config.api_key,
                allow_write: config.allow_write,
                error: None,
            };
            self.set_status(status.clone());
            return Ok(status);
        }

        let port = if config.port == 0 {
            DEFAULT_PORT
        } else {
            config.port
        };

        let listener = match tokio::net::TcpListener::bind(("127.0.0.1", port)).await {
            Ok(listener) => listener,
            Err(error) => {
                let message = format!("Failed to bind 127.0.0.1:{}: {}", port, error);
                self.set_status(HttpApiStatus {
                    enabled: true,
                    running: false,
                    port,
                    api_key: config.api_key,
                    allow_write: config.allow_write,
                    error: Some(message.clone()),
                });
                return Err(message);
            }
        };

        let actual_port = listener
            .local_addr()
            .map_err(|error| format!("Failed to read listener address: {}", error))?
            .port();

        let router = crate::http_api::routes::build_router(app, db, blob_store, &config);
        let handle = tokio::spawn(async move {
            if let Err(error) = axum::serve(listener, router).await {
                log::error!("HTTP API server stopped: {}", error);
            }
        });

        if let Ok(mut guard) = self.server.lock() {
            *guard = Some(RunningServer { handle });
        }

        let status = HttpApiStatus {
            enabled: true,
            running: true,
            port: actual_port,
            api_key: config.api_key,
            allow_write: config.allow_write,
            error: None,
        };
        self.set_status(status.clone());
        Ok(status)
    }

    fn set_status(&self, status: HttpApiStatus) {
        if let Ok(mut guard) = self.status.lock() {
            *guard = status;
        }
    }
}
