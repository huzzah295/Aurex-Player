use crate::commands::MpvState;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

/// Shared enable/disable switch for the Dynamic Accent Color sampler. Wrapped
/// in an Arc so both the Tauri-managed state (for the toggle command) and the
/// background sampling loop spawned once in `lib.rs` `setup()` can share it.
#[derive(Clone, Default)]
pub struct DynamicAccentFlag(pub Arc<AtomicBool>);

/// The mpv `vf` label used for the accent-sampling filter chain - referenced
/// both when installing it and when reading its metadata back.
const VF_LABEL: &str = "aurexaccent";

/// `format=yuv420p` first forces a known 8-bit sample range regardless of the
/// source's actual pixel format/bit depth, so the YAVG/UAVG/VAVG values read
/// back afterward are always plain 0-255 numbers - `signalstats` alone would
/// report them in whatever range the source's own format happens to use.
/// This never touches a raw pixel buffer: `signalstats` computes the average
/// as a normal side effect of decoding and publishes it as frame metadata,
/// which mpv can hand back as a plain string-keyed property (see
/// `vf-metadata` below) - unlike `screenshot-raw`, whose raw byte-array
/// response mpv's own JSON IPC serializer has no case for and can't send
/// over this pipe at all.
fn filter_spec() -> String {
    format!("@{VF_LABEL}:lavfi=[format=yuv420p,signalstats]")
}

#[tauri::command]
pub async fn set_dynamic_accent_enabled(
    flag: State<'_, DynamicAccentFlag>,
    mpv: State<'_, MpvState>,
    enabled: bool,
) -> Result<(), String> {
    flag.0.store(enabled, Ordering::Relaxed);
    let guard = mpv.lock().await;
    if let Some(handle) = guard.as_ref() {
        let value = if enabled { filter_spec() } else { String::new() };
        let _ = handle.set_property("vf", json!(value)).await;
    }
    Ok(())
}

/// Converts an 8-bit YUV (BT.601) triple to RGB, clamped to 0-255. Close
/// enough for an ambient accent tint - not meant to be colorimetrically
/// exact.
fn yuv_to_rgb(y: f64, u: f64, v: f64) -> (u8, u8, u8) {
    let cb = u - 128.0;
    let cr = v - 128.0;
    let r = y + 1.402 * cr;
    let g = y - 0.344136 * cb - 0.714136 * cr;
    let b = y + 1.772 * cb;
    let clamp = |c: f64| c.round().clamp(0.0, 255.0) as u8;
    (clamp(r), clamp(g), clamp(b))
}

/// Finds a metadata value whose key ends with `suffix` (e.g. "YAVG") -
/// matched by suffix rather than the full expected `lavfi.signalstats.YAVG`
/// key so this keeps working even if mpv/ffmpeg versions differ slightly in
/// how they prefix it. ffmpeg frame metadata values are always strings.
fn find_stat(map: &Value, suffix: &str) -> Option<f64> {
    map.as_object()?
        .iter()
        .find(|(key, _)| key.ends_with(suffix))
        .and_then(|(_, value)| value.as_str())
        .and_then(|s| s.parse::<f64>().ok())
}

/// Started once from `lib.rs` `setup()`. Every ~8s, while enabled and a video
/// is actually loaded, reads the average-color frame metadata the
/// `signalstats` filter (installed by `set_dynamic_accent_enabled` above) is
/// already computing as a normal side effect of decoding - a single
/// `get_property` round-trip over the same IPC pipe already used for Media
/// Info, no raw pixel transfer of any kind. Entirely skipped (not even the
/// property read) whenever disabled, so there is zero ongoing cost unless a
/// user has opted in.
pub fn start(app: AppHandle, flag: Arc<AtomicBool>) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(8)).await;
            if !flag.load(Ordering::Relaxed) {
                continue;
            }

            let state = app.state::<MpvState>();
            let guard = state.lock().await;
            let Some(handle) = guard.as_ref() else { continue };

            let is_idle = handle
                .get_property("idle-active")
                .await
                .ok()
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            if is_idle {
                continue;
            }

            let Ok(metadata) = handle.get_property(&format!("vf-metadata/{VF_LABEL}")).await else {
                continue;
            };
            drop(guard);

            let (Some(y), Some(u), Some(v)) = (
                find_stat(&metadata, "YAVG"),
                find_stat(&metadata, "UAVG"),
                find_stat(&metadata, "VAVG"),
            ) else {
                continue;
            };

            let (r, g, b) = yuv_to_rgb(y, u, v);
            let _ = app.emit("accent-color://update", json!({ "r": r, "g": g, "b": b }));
        }
    });
}
