use crate::commands::MpvState;
use crate::mpv_ipc::MpvHandle;
use serde::Serialize;
use serde_json::Value;
use tauri::State;

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleTrackInfo {
    lang: Option<String>,
    title: Option<String>,
    codec: Option<String>,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    title: Option<String>,
    duration_seconds: Option<f64>,
    width: Option<i64>,
    height: Option<i64>,
    aspect: Option<f64>,
    video_codec: Option<String>,
    audio_codec: Option<String>,
    fps: Option<f64>,
    video_bitrate_bps: Option<f64>,
    audio_bitrate_bps: Option<f64>,
    audio_channels: Option<i64>,
    hdr: Option<String>,
    container_format: Option<String>,
    subtitle_tracks: Vec<SubtitleTrackInfo>,
    file_size_bytes: Option<u64>,
    file_path: Option<String>,
}

async fn get_prop(handle: &MpvHandle, name: &str) -> Option<Value> {
    handle.get_property(name).await.ok()
}

/// Everything mpv itself knows about the currently loaded file - no
/// ffprobe is bundled, so this is the only source for codec/resolution/fps/
/// bitrate/HDR/subtitle-track data. File size/path come straight from the
/// filesystem instead of round-tripping through mpv for something Rust
/// already has cheap, direct access to.
#[tauri::command]
pub async fn get_media_info(state: State<'_, MpvState>, path: String) -> Result<MediaInfo, String> {
    let guard = state.lock().await;
    let handle = guard.as_ref().ok_or("mpv is not ready")?;

    let mut info = MediaInfo {
        title: get_prop(handle, "media-title").await.and_then(|v| v.as_str().map(String::from)),
        duration_seconds: get_prop(handle, "duration").await.and_then(|v| v.as_f64()),
        video_codec: get_prop(handle, "video-codec").await.and_then(|v| v.as_str().map(String::from)),
        audio_codec: get_prop(handle, "audio-codec").await.and_then(|v| v.as_str().map(String::from)),
        container_format: get_prop(handle, "file-format").await.and_then(|v| v.as_str().map(String::from)),
        video_bitrate_bps: get_prop(handle, "video-bitrate").await.and_then(|v| v.as_f64()),
        audio_bitrate_bps: get_prop(handle, "audio-bitrate").await.and_then(|v| v.as_f64()),
        ..Default::default()
    };

    // "container-fps" is the container's declared rate; fall back to mpv's
    // own running estimate (from decoded frame timing) for files that don't
    // declare one cleanly.
    info.fps = match get_prop(handle, "container-fps").await.and_then(|v| v.as_f64()).filter(|f| *f > 0.0) {
        Some(fps) => Some(fps),
        None => get_prop(handle, "estimated-vf-fps").await.and_then(|v| v.as_f64()),
    };

    if let Some(params) = get_prop(handle, "video-params").await {
        info.width = params.get("w").and_then(Value::as_i64);
        info.height = params.get("h").and_then(Value::as_i64);
        info.aspect = params.get("aspect").and_then(Value::as_f64);
        let gamma = params.get("gamma").and_then(Value::as_str).unwrap_or("");
        let sig_peak = params.get("sig-peak").and_then(Value::as_f64).unwrap_or(1.0);
        info.hdr = if gamma == "pq" {
            Some("HDR10".to_string())
        } else if gamma == "hlg" {
            Some("HLG".to_string())
        } else if sig_peak > 1.0 {
            Some("HDR".to_string())
        } else {
            None
        };
    }

    if let Some(params) = get_prop(handle, "audio-params").await {
        info.audio_channels = params.get("channel-count").and_then(Value::as_i64);
    }

    if let Some(Value::Array(tracks)) = get_prop(handle, "track-list").await {
        info.subtitle_tracks = tracks
            .iter()
            .filter(|t| t.get("type").and_then(Value::as_str) == Some("sub"))
            .map(|t| SubtitleTrackInfo {
                lang: t.get("lang").and_then(Value::as_str).map(String::from),
                title: t.get("title").and_then(Value::as_str).map(String::from),
                codec: t.get("codec").and_then(Value::as_str).map(String::from),
            })
            .collect();
    }

    info.file_size_bytes = std::fs::metadata(&path).ok().map(|m| m.len());
    info.file_path = Some(path);

    Ok(info)
}
