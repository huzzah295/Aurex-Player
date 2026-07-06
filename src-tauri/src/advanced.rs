use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// Pro/Advanced settings that need to exist before the webview (and thus any
/// `localStorage`-backed store) does - the mpv sidecar's startup args and
/// whether file logging is enabled are both decided in `lib.rs` `setup()`,
/// before a single frontend command could ever be invoked. Kept in their own
/// small JSON file for that reason, mirroring `window_state.rs`.
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AdvancedConfig {
    pub hwdec: String,
    pub demuxer_max_bytes: String,
    pub vo: String,
    pub logging_enabled: bool,
    pub experimental_features: bool,
}

/// These three fields ultimately become either a live `set_property` IPC call
/// (see `commands::mpv_set_pro_property`) or a literal mpv sidecar argument
/// (`--hwdec=`, `--vo=`, `--demuxer-max-bytes=` in `lib.rs`) - restricting them
/// to the exact set of values the UI ever offers means a caller invoking this
/// command directly can't smuggle in something else (e.g. an unbounded
/// buffer size that could exhaust RAM, or a `vo`/`hwdec` value mpv doesn't
/// actually support).
pub const ALLOWED_HWDEC: &[&str] = &["auto-safe", "auto", "no"];
pub const ALLOWED_VO: &[&str] = &["gpu-next", "gpu"];
pub const ALLOWED_DEMUXER_MAX_BYTES: &[&str] = &["150MiB", "300MiB", "600MiB"];

impl Default for AdvancedConfig {
    fn default() -> Self {
        Self {
            hwdec: "auto-safe".to_string(),
            demuxer_max_bytes: "150MiB".to_string(),
            vo: "gpu-next".to_string(),
            logging_enabled: false,
            experimental_features: false,
        }
    }
}

fn config_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_data_dir().ok().map(|dir| dir.join("advanced-settings.json"))
}

/// Read directly (not as a `#[tauri::command]`) so `setup()` can use it
/// before the webview exists.
pub fn load(app: &AppHandle) -> AdvancedConfig {
    let Some(path) = config_path(app) else {
        return AdvancedConfig::default();
    };
    let Ok(contents) = std::fs::read_to_string(&path) else {
        return AdvancedConfig::default();
    };
    serde_json::from_str(&contents).unwrap_or_default()
}

#[tauri::command]
pub fn get_advanced_config(app: AppHandle) -> AdvancedConfig {
    load(&app)
}

/// Renderer selection and logging only take effect on the next launch (see
/// `setup()`) - deliberately not hot-applied, since live-switching the video
/// output is the fragile part of this pipeline. Hardware acceleration and
/// buffer size *are* also applied live, immediately, via
/// `commands::mpv_set_pro_property` - this command only handles persistence
/// so all of them survive a restart.
#[tauri::command]
pub fn set_advanced_config(app: AppHandle, config: AdvancedConfig) -> Result<(), String> {
    if !ALLOWED_HWDEC.contains(&config.hwdec.as_str()) {
        return Err(format!("unsupported hwdec value: {}", config.hwdec));
    }
    if !ALLOWED_VO.contains(&config.vo.as_str()) {
        return Err(format!("unsupported vo value: {}", config.vo));
    }
    if !ALLOWED_DEMUXER_MAX_BYTES.contains(&config.demuxer_max_bytes.as_str()) {
        return Err(format!("unsupported demuxer-max-bytes value: {}", config.demuxer_max_bytes));
    }

    let path = config_path(&app).ok_or("no app data directory")?;
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let json = serde_json::to_string(&config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}
