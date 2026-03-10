use std::sync::atomic::{AtomicBool, Ordering};

#[cfg(target_os = "macos")]
pub(crate) mod macos;
#[cfg(target_os = "windows")]
pub(crate) mod windows;
#[cfg(target_os = "linux")]
pub(crate) mod linux;

// Re-export the active platform module as `simulator` so that existing
// call-sites (`use crate::paste::simulator; simulator::paste_text(...)`)
// continue to work without modification.
#[cfg(target_os = "macos")]
pub(crate) use macos as simulator;
#[cfg(target_os = "windows")]
pub(crate) use windows as simulator;
#[cfg(target_os = "linux")]
pub(crate) use linux as simulator;

/// Set to `true` immediately before the clipboard is written during a paste
/// operation. The clipboard monitor in `lib.rs` reads and clears this flag
/// when it detects the resulting clipboard change, so the resulting
/// `clipboard-changed` event can be tagged with `from_paste = true` and the
/// frontend knows to suppress the "Copied" toast for that event.
pub static PASTE_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

/// Mark that a paste is about to write to the clipboard.
#[inline]
pub fn begin_paste() {
    PASTE_IN_PROGRESS.store(true, Ordering::Relaxed);
}

/// Consume and return whether the last clipboard change came from a paste.
/// Resets the flag atomically so only the first clipboard-changed event per
/// paste is tagged.
#[inline]
pub fn take_paste_in_progress() -> bool {
    PASTE_IN_PROGRESS.swap(false, Ordering::Relaxed)
}
