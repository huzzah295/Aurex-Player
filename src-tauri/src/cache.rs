use serde::Serialize;
use std::path::Path;
use tauri::{AppHandle, Manager};

/// Subdirectories of the WebView2 profile that hold genuinely disposable
/// cache data (HTTP cache, compiled JS cache, GPU shader/graphics caches,
/// component update caches) - never "Local Storage", "Session Storage", or
/// anything else that could hold user data. Aurex Player's own settings,
/// shortcuts, theme, and onboarding flag live in `localStorage`, which is
/// backed by "Local Storage" - explicitly untouched. Labeled "Playback
/// Cache" in the UI since it's the closest real analog this app has: mpv
/// itself keeps no persistent disk cache for local file playback.
const SAFE_CACHE_DIRS: &[&str] = &[
    "Default/Cache",
    "Default/Code Cache",
    "Default/GPUCache",
    "GPUPersistentCache",
    "GrShaderCache",
    "ShaderCache",
    "component_crx_cache",
    "extensions_crx_cache",
];

fn webview_root(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(|e| e.to_string())?.join("EBWebView"))
}

/// Recursively sums file sizes under `dir`. Missing directories (nothing
/// cached yet) and individual unreadable entries are treated as 0, not an
/// error - a cache category that doesn't exist yet is a normal, common state.
fn dir_size(dir: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return 0;
    };
    entries
        .flatten()
        .map(|entry| {
            let path = entry.path();
            if path.is_dir() {
                dir_size(&path)
            } else {
                entry.metadata().map(|m| m.len()).unwrap_or(0)
            }
        })
        .sum()
}

fn temp_files_size() -> u64 {
    let temp_dir = std::env::temp_dir();
    let Ok(entries) = std::fs::read_dir(&temp_dir) else {
        return 0;
    };
    entries
        .flatten()
        .filter(|entry| entry.file_name().to_string_lossy().starts_with("aurex-"))
        .map(|entry| {
            let path = entry.path();
            if path.is_dir() {
                dir_size(&path)
            } else {
                entry.metadata().map(|m| m.len()).unwrap_or(0)
            }
        })
        .sum()
}

fn clear_temp_files_inner() {
    let temp_dir = std::env::temp_dir();
    if let Ok(entries) = std::fs::read_dir(&temp_dir) {
        for entry in entries.flatten() {
            if entry.file_name().to_string_lossy().starts_with("aurex-") {
                let path = entry.path();
                if path.is_dir() {
                    let _ = std::fs::remove_dir_all(&path);
                } else {
                    let _ = std::fs::remove_file(&path);
                }
            }
        }
    }
}

fn clear_playback_cache_inner(app: &AppHandle) -> Result<(), String> {
    let root = webview_root(app)?;
    for relative in SAFE_CACHE_DIRS {
        let _ = std::fs::remove_dir_all(root.join(relative));
    }
    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheSizes {
    playback_bytes: u64,
    temp_bytes: u64,
    total_bytes: u64,
}

/// Best-effort by design: some files may be locked while the app is running
/// (WebView2 keeps handles open to parts of its own cache), so sizes/clears
/// can't guarantee a fully clean sweep until the next app restart. Never
/// touches playlists, favorites, resume history, or any persisted settings
/// (shortcuts, theme, accent, onboarding, equalizer) - all of which live in
/// `localStorage` under "Local Storage", untouched by any of these.
#[tauri::command]
pub async fn get_cache_sizes(app: AppHandle) -> Result<CacheSizes, String> {
    let playback_bytes = dir_size(&webview_root(&app)?);
    let temp_bytes = temp_files_size();
    Ok(CacheSizes {
        playback_bytes,
        temp_bytes,
        total_bytes: playback_bytes + temp_bytes,
    })
}

#[tauri::command]
pub async fn clear_playback_cache(app: AppHandle) -> Result<(), String> {
    clear_playback_cache_inner(&app)
}

#[tauri::command]
pub async fn clear_temp_files(_app: AppHandle) -> Result<(), String> {
    clear_temp_files_inner();
    Ok(())
}

#[tauri::command]
pub async fn clear_all_cache(app: AppHandle) -> Result<(), String> {
    clear_playback_cache_inner(&app)?;
    clear_temp_files_inner();
    Ok(())
}
