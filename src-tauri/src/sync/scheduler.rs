use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Notify;

pub struct SyncScheduler {
    running: Arc<AtomicBool>,
    notify: Arc<Notify>,
}

impl SyncScheduler {
    pub fn new() -> Self {
        Self {
            running: Arc::new(AtomicBool::new(false)),
            notify: Arc::new(Notify::new()),
        }
    }

    pub fn start_interval(&self, interval_minutes: u64, sync_fn: Arc<dyn Fn() + Send + Sync>) {
        let running = self.running.clone();
        let notify = self.notify.clone();
        running.store(true, Ordering::SeqCst);

        tokio::spawn(async move {
            let duration = tokio::time::Duration::from_secs(interval_minutes * 60);
            while running.load(Ordering::SeqCst) {
                tokio::select! {
                    _ = tokio::time::sleep(duration) => {
                        sync_fn();
                    }
                    _ = notify.notified() => {
                        // Manual trigger or stop signal
                        if running.load(Ordering::SeqCst) {
                            sync_fn();
                        }
                    }
                }
            }
        });
    }

    pub fn trigger_now(&self) {
        self.notify.notify_one();
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        self.notify.notify_one();
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }
}
