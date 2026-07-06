use crate::mpv_ipc::MpvHandle;
use crate::mpv_window::{resize_video_surface, set_video_surface_dim, set_video_surface_exclusion};
use serde_json::json;
use std::time::Duration;
use tauri::State;
use tokio::sync::Mutex as AsyncMutex;

pub type MpvState = AsyncMutex<Option<MpvHandle>>;

/// mpv connects to its IPC pipe asynchronously right after app launch, which
/// can take a moment. Rather than failing commands issued in that window
/// (e.g. a user double-clicking a file the instant the window appears), wait
/// briefly for the handle to become available.
async fn wait_for_mpv(state: &State<'_, MpvState>) -> Result<(), String> {
    for _ in 0..50 {
        if state.lock().await.is_some() {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Err("mpv did not start in time".to_string())
}

macro_rules! send {
    ($state:expr, $args:expr) => {{
        wait_for_mpv(&$state).await?;
        let guard = $state.lock().await;
        match guard.as_ref() {
            Some(handle) => handle.command($args).await.map_err(|e| e.to_string()),
            None => Err("mpv is not ready".to_string()),
        }
    }};
}

#[tauri::command]
pub async fn mpv_open(state: State<'_, MpvState>, path: String) -> Result<(), String> {
    send!(state, vec![json!("loadfile"), json!(path), json!("replace")])
}

#[tauri::command]
pub async fn mpv_play(state: State<'_, MpvState>) -> Result<(), String> {
    send!(state, vec![json!("set_property"), json!("pause"), json!(false)])
}

#[tauri::command]
pub async fn mpv_pause(state: State<'_, MpvState>) -> Result<(), String> {
    send!(state, vec![json!("set_property"), json!("pause"), json!(true)])
}

#[tauri::command]
pub async fn mpv_toggle_play_pause(state: State<'_, MpvState>) -> Result<(), String> {
    send!(state, vec![json!("cycle"), json!("pause")])
}

#[tauri::command]
pub async fn mpv_stop(state: State<'_, MpvState>) -> Result<(), String> {
    send!(state, vec![json!("stop")])
}

#[tauri::command]
pub async fn mpv_seek(state: State<'_, MpvState>, seconds: f64) -> Result<(), String> {
    send!(state, vec![json!("seek"), json!(seconds), json!("absolute")])
}

#[tauri::command]
pub async fn mpv_seek_relative(state: State<'_, MpvState>, delta_seconds: f64) -> Result<(), String> {
    send!(state, vec![json!("seek"), json!(delta_seconds), json!("relative")])
}

#[tauri::command]
pub async fn mpv_frame_step(state: State<'_, MpvState>, forward: bool) -> Result<(), String> {
    let cmd = if forward { "frame-step" } else { "frame-back-step" };
    send!(state, vec![json!(cmd)])
}

#[tauri::command]
pub async fn mpv_set_volume(state: State<'_, MpvState>, volume: f64) -> Result<(), String> {
    send!(state, vec![json!("set_property"), json!("volume"), json!(volume * 100.0)])
}

#[tauri::command]
pub async fn mpv_set_muted(state: State<'_, MpvState>, muted: bool) -> Result<(), String> {
    send!(state, vec![json!("set_property"), json!("mute"), json!(muted)])
}

#[tauri::command]
pub async fn mpv_set_speed(state: State<'_, MpvState>, speed: f64) -> Result<(), String> {
    send!(state, vec![json!("set_property"), json!("speed"), json!(speed)])
}

/// mpv's built-in video-equalizer properties. Whitelisted rather than
/// accepting an arbitrary property name, since this value ultimately reaches
/// mpv's `set_property` IPC command.
const ALLOWED_VIDEO_PROPERTIES: &[&str] = &["brightness", "contrast", "saturation", "gamma", "hue"];

#[tauri::command]
pub async fn mpv_set_video_property(
    state: State<'_, MpvState>,
    property: String,
    value: f64,
) -> Result<(), String> {
    if !ALLOWED_VIDEO_PROPERTIES.contains(&property.as_str()) {
        return Err(format!("unsupported video property: {property}"));
    }
    send!(state, vec![json!("set_property"), json!(property), json!(value)])
}

/// Standard ISO 10-band graphic equalizer center frequencies (Hz), applied
/// via mpv's `af` (audio filter chain) property as chained `lavfi` biquad
/// `equalizer` stages. Frequencies are fixed server-side, not user input -
/// only the per-band gain floats (clamped below) are interpolated into the
/// filter string, so this can't be used to inject arbitrary filter syntax
/// the way accepting a raw filter string from the frontend could.
const EQ_BANDS: [f64; 10] = [31.0, 62.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0];
const EQ_GAIN_LIMIT_DB: f64 = 20.0;

#[tauri::command]
pub async fn mpv_set_equalizer(state: State<'_, MpvState>, bands: Vec<f64>, enabled: bool) -> Result<(), String> {
    if bands.len() != EQ_BANDS.len() {
        return Err(format!("expected {} bands, got {}", EQ_BANDS.len(), bands.len()));
    }

    let filter = if !enabled {
        String::new()
    } else {
        // Bands within a hair of 0dB are skipped so a mostly-flat curve
        // produces a short (or empty) filter chain instead of ten no-op
        // stages - cheaper for mpv to process every audio buffer through.
        let stages: Vec<String> = EQ_BANDS
            .iter()
            .zip(bands.iter())
            .filter(|(_, gain)| gain.abs() > 0.1)
            .map(|(freq, gain)| {
                let clamped = gain.clamp(-EQ_GAIN_LIMIT_DB, EQ_GAIN_LIMIT_DB);
                format!("equalizer=f={freq}:width_type=o:width=1:g={clamped:.2}")
            })
            .collect();
        if stages.is_empty() {
            String::new()
        } else {
            format!("lavfi=[{}]", stages.join(","))
        }
    };
    send!(state, vec![json!("set_property"), json!("af"), json!(filter)])
}

#[tauri::command]
pub async fn mpv_resize_surface(
    state: State<'_, MpvState>,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
) -> Result<(), String> {
    let guard = state.lock().await;
    if let Some(handle) = guard.as_ref() {
        resize_video_surface(handle.video_hwnd, x, y, width, height);
    }
    Ok(())
}

#[tauri::command]
pub async fn mpv_set_surface_dim(state: State<'_, MpvState>, dimmed: bool) -> Result<(), String> {
    let guard = state.lock().await;
    if let Some(handle) = guard.as_ref() {
        set_video_surface_dim(handle.video_hwnd, dimmed);
    }
    Ok(())
}

#[tauri::command]
pub async fn mpv_set_surface_exclusion(
    state: State<'_, MpvState>,
    width: i32,
    height: i32,
    exclude_x: i32,
    exclude_y: i32,
    exclude_width: i32,
    exclude_height: i32,
) -> Result<(), String> {
    let guard = state.lock().await;
    if let Some(handle) = guard.as_ref() {
        set_video_surface_exclusion(handle.video_hwnd, width, height, exclude_x, exclude_y, exclude_width, exclude_height);
    }
    Ok(())
}

/// mpv properties Pro Settings is allowed to change live (in addition to
/// persisting them for next launch via `advanced::set_advanced_config`).
/// Both the property name (via the match arms below) and the value (via
/// `advanced::ALLOWED_*`) are whitelisted - this ultimately reaches mpv's
/// `set_property` IPC command. Renderer selection deliberately has no live
/// equivalent here - see `advanced.rs`.
#[tauri::command]
pub async fn mpv_set_pro_property(
    state: State<'_, MpvState>,
    property: String,
    value: String,
) -> Result<(), String> {
    let allowed_values: &[&str] = match property.as_str() {
        "hwdec" => crate::advanced::ALLOWED_HWDEC,
        "demuxer-max-bytes" => crate::advanced::ALLOWED_DEMUXER_MAX_BYTES,
        _ => return Err(format!("unsupported property: {property}")),
    };
    if !allowed_values.contains(&value.as_str()) {
        return Err(format!("unsupported value for {property}: {value}"));
    }
    send!(state, vec![json!("set_property"), json!(property), json!(value)])
}

const MEDIA_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "mpeg", "mpg", "ts", "m4v",
    "mp3", "wav", "flac", "aac", "ogg", "opus", "m4a",
];

/// Lists media files directly inside a folder (non-recursive), sorted by
/// name, for the "Open Folder" menu action.
#[tauri::command]
pub async fn list_media_files(folder: String) -> Result<Vec<String>, String> {
    let mut entries: Vec<String> = std::fs::read_dir(&folder)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_file())
        .filter(|entry| {
            entry
                .path()
                .extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| MEDIA_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
                .unwrap_or(false)
        })
        .map(|entry| entry.path().to_string_lossy().into_owned())
        .collect();
    entries.sort();
    Ok(entries)
}
