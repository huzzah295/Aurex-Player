use tauri::{AppHandle, Manager};

/// Deletes the persisted window geometry file (see `window_state.rs`) so the
/// next launch falls back to Tauri's configured default size/position,
/// instead of trying to reset window position/size live on the currently
/// running window - simpler, and consistent with how "Reset playback engine"
/// below also prefers a fresh-start relaunch over any risky in-place reset.
#[tauri::command]
pub fn reset_window_state(app: AppHandle) -> Result<(), String> {
    let Some(dir) = app.path().app_data_dir().ok() else {
        return Ok(());
    };
    let path = dir.join("window-state.json");
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
