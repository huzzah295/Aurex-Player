use tauri::{AppHandle, Manager};
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE};

const DWMWCP_DEFAULT: i32 = 0;
const DWMWCP_ROUND: i32 = 2;

/// Rounds the main window's corners via the Windows 11 DWM API while the
/// Liquid Glass theme is active, reverting to square corners for Dark/
/// Light/OLED. This is a lightweight native attribute on the existing
/// opaque window - not a switch to a transparent/borderless-compositing
/// window architecture, which would risk destabilizing the mpv video
/// surface and the other overlay windows for every theme, not just this
/// one. On Windows 10 (which doesn't support this attribute) the call
/// harmlessly fails and the window just keeps its normal square corners.
#[tauri::command]
pub async fn set_window_rounded(app: AppHandle, rounded: bool) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("main window missing")?;
    let hwnd = window.hwnd().map_err(|e| e.to_string())?;
    let preference: i32 = if rounded { DWMWCP_ROUND } else { DWMWCP_DEFAULT };
    unsafe {
        let _ = DwmSetWindowAttribute(
            HWND(hwnd.0 as *mut _),
            DWMWA_WINDOW_CORNER_PREFERENCE,
            &preference as *const i32 as *const std::ffi::c_void,
            std::mem::size_of::<i32>() as u32,
        );
    }
    Ok(())
}
