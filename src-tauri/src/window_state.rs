use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

#[derive(Serialize, Deserialize, Clone, Copy)]
pub struct WindowGeometry {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl WindowGeometry {
    /// Rejects Windows' well-known "minimized" placeholder geometry
    /// (reported as approximately x=y=-32000 with a tiny size) and other
    /// clearly degenerate values, so a bad save - or a leftover file from an
    /// older buggy version of this code - can never make the window open
    /// invisible/off-screen. `note_change` below also now skips saving while
    /// actually minimized, but this is defense in depth on the read side too.
    fn is_plausible(&self) -> bool {
        self.x > -30000 && self.y > -30000 && self.width >= 200 && self.height >= 150
    }
}

static LAST_GEOMETRY: Mutex<Option<WindowGeometry>> = Mutex::new(None);
static GENERATION: AtomicU64 = AtomicU64::new(0);

/// Long enough that dragging/resizing the window doesn't hit disk on every
/// single tick of the move/resize (which would show up as UI lag) - only
/// once motion has settled. Short enough that a crash shortly after the user
/// finishes still loses at most this much.
const SAVE_DEBOUNCE_MS: u64 = 500;

fn state_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join("window-state.json"))
}

/// Applied once at startup, before the main window is shown (see lib.rs's
/// `setup`), so there's never a visible jump from the default geometry to
/// the restored one.
pub fn restore(app: &AppHandle, window: &WebviewWindow) {
    let Some(path) = state_path(app) else { return };
    let Ok(contents) = std::fs::read_to_string(&path) else { return };
    let Ok(geometry) = serde_json::from_str::<WindowGeometry>(&contents) else { return };
    if !geometry.is_plausible() {
        return;
    }
    let _ = window.set_position(tauri::Position::Physical(PhysicalPosition {
        x: geometry.x,
        y: geometry.y,
    }));
    let _ = window.set_size(tauri::Size::Physical(PhysicalSize {
        width: geometry.width,
        height: geometry.height,
    }));
}

/// Records the window's current geometry in memory (cheap) and schedules a
/// debounced write to disk - called from the main window's `Moved`/`Resized`
/// event handlers in `lib.rs`. Uses the same generation-token debounce
/// pattern as `fullscreen_bar_window.rs`'s auto-hide timer.
pub fn note_change(app: AppHandle, window: WebviewWindow) {
    if let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) {
        *LAST_GEOMETRY.lock().unwrap() = Some(WindowGeometry {
            x: pos.x,
            y: pos.y,
            width: size.width,
            height: size.height,
        });
    }

    let generation = GENERATION.fetch_add(1, Ordering::SeqCst) + 1;
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_millis(SAVE_DEBOUNCE_MS)).await;
        if GENERATION.load(Ordering::SeqCst) != generation {
            return;
        }
        // Maximized/minimized/fullscreen bounds aren't a useful "restored"
        // geometry to save. Minimized in particular is reported by Windows
        // as a placeholder position far off-screen (see `is_plausible`) -
        // saving that would make the next launch open invisible.
        if window.is_maximized().unwrap_or(false)
            || window.is_minimized().unwrap_or(false)
            || window.is_fullscreen().unwrap_or(false)
        {
            return;
        }
        let Some(geometry) = *LAST_GEOMETRY.lock().unwrap() else { return };
        if !geometry.is_plausible() {
            return;
        }
        let Some(path) = state_path(&app) else { return };
        if let Ok(json) = serde_json::to_string(&geometry) {
            let _ = std::fs::write(path, json);
        }
    });
}
