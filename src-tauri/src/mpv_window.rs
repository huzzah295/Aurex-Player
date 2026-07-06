use serde_json::json;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use windows::core::PCWSTR;
use windows::Win32::Foundation::{COLORREF, HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::Graphics::Gdi::{CombineRgn, CreateRectRgn, DeleteObject, SetWindowRgn, RGN_DIFF};
use windows::Win32::UI::Input::KeyboardAndMouse::GetDoubleClickTime;
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExW, DefWindowProcW, GetWindowLongPtrW, GetWindowLongW, KillTimer, LoadCursorW,
    RegisterClassW, SetCursor, SetLayeredWindowAttributes, SetParent, SetTimer, SetWindowLongPtrW,
    SetWindowLongW, ShowWindow, CS_DBLCLKS, CS_HREDRAW, CS_VREDRAW, GWLP_USERDATA, GWL_EXSTYLE,
    IDC_ARROW, LWA_ALPHA, SW_HIDE, SW_SHOW, WM_DESTROY, WM_LBUTTONDBLCLK, WM_LBUTTONUP,
    WM_MOUSEMOVE, WM_MOUSEWHEEL, WM_SETCURSOR, WM_TIMER, WNDCLASSW, WS_CHILD, WS_EX_LAYERED,
};

const CLASS_NAME: &str = "AurexMpvSurface";

/// WM_MOUSEMOVE fires far more often than anything needs to react to it (a
/// fullscreen auto-hide timer just needs to know "movement happened
/// recently"), so emits are throttled to at most once per this interval.
const MOUSEMOVE_THROTTLE_MS: u64 = 150;
static LAST_MOUSEMOVE_EMIT_MS: AtomicU64 = AtomicU64::new(0);

/// Last client-area cursor position seen by this window, packed as
/// `(x << 32) | y` for a single atomic compare-and-swap. Windows redelivers a
/// WM_MOUSEMOVE with the *same* coordinates as before whenever this window's
/// z-order/visibility changes near the cursor - notably when the fullscreen
/// auto-hide bar (an always-on-top window) hides itself, which exposes this
/// surface underneath. Treating that as "the mouse moved" would immediately
/// re-trigger the auto-hide pulse, show the bar again, restart its own
/// countdown, hide again, get redelivered another synthetic move, and repeat
/// forever - so only a position that actually changed counts as movement.
static LAST_MOUSE_POS: AtomicU64 = AtomicU64::new(u64::MAX);

fn pack_pos(x: i32, y: i32) -> u64 {
    ((x as u32 as u64) << 32) | (y as u32 as u64)
}

/// Whether the cursor should be hidden while it's over the video surface -
/// driven by the same fullscreen auto-hide timer that hides the control bar
/// (see `fullscreen_bar_window::pulse_fullscreen_controls`), so both hide
/// and reappear in sync. `WM_SETCURSOR` re-applies this on (almost) every
/// mouse move; `set_cursor_hidden` also applies it immediately itself, since
/// the transition to hidden happens on a timer with no mouse move to prompt
/// a fresh `WM_SETCURSOR`.
static CURSOR_HIDDEN: AtomicBool = AtomicBool::new(false);

/// Win32 delivers a double-click as `LBUTTONDOWN, LBUTTONUP, LBUTTONDOWN,
/// LBUTTONDBLCLK, LBUTTONUP` - the *second* click still produces a real
/// `WM_LBUTTONUP`. Emitting a click straight from every `WM_LBUTTONUP` would
/// therefore fire the single-click play/pause action twice on every
/// double-click (once per mouseup) in addition to the intended dblclick
/// action, producing a pause/resume flicker right as fullscreen is entered.
/// Instead, a click's emission is delayed by the OS double-click interval via
/// this timer so a following `WM_LBUTTONDBLCLK` can cancel it, and the
/// second click's own mouseup is suppressed via `SUPPRESS_NEXT_CLICKUP` so it
/// doesn't schedule another one.
const CLICK_TIMER_ID: usize = 1;
static SUPPRESS_NEXT_CLICKUP: AtomicBool = AtomicBool::new(false);

unsafe fn apply_cursor_visibility(hidden: bool) {
    // HCURSOR doesn't support the `None`-for-null convenience `SetCursor`
    // relies on for handle types like HWND/HRGN - construct it directly
    // instead. A zeroed/default HCURSOR is a null handle, which is exactly
    // what `SetCursor(NULL)` documents as "hide the cursor".
    let cursor = if hidden {
        windows::Win32::UI::WindowsAndMessaging::HCURSOR::default()
    } else {
        LoadCursorW(None, IDC_ARROW).unwrap_or_default()
    };
    let _ = SetCursor(cursor);
}

/// Shows or hides the cursor over the video surface. Safe to call from any
/// thread (including the fullscreen auto-hide timer's background task):
/// `SetCursor` takes effect immediately regardless of which thread calls it.
pub fn set_cursor_hidden(hidden: bool) {
    if CURSOR_HIDDEN.swap(hidden, Ordering::SeqCst) != hidden {
        unsafe { apply_cursor_visibility(hidden) };
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

unsafe extern "system" fn wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    match msg {
        WM_LBUTTONUP => {
            if SUPPRESS_NEXT_CLICKUP.swap(false, Ordering::SeqCst) {
                // This mouseup is the second click of a double-click that
                // already fired WM_LBUTTONDBLCLK below - not a click of its
                // own.
            } else {
                let _ = SetTimer(hwnd, CLICK_TIMER_ID, GetDoubleClickTime(), None);
            }
        }
        WM_LBUTTONDBLCLK => {
            let _ = KillTimer(hwnd, CLICK_TIMER_ID);
            SUPPRESS_NEXT_CLICKUP.store(true, Ordering::SeqCst);
            if let Some(app) = app_handle_from(hwnd) {
                let _ = app.emit("mpv://surface-dblclick", ());
            }
        }
        WM_TIMER if wparam.0 == CLICK_TIMER_ID => {
            let _ = KillTimer(hwnd, CLICK_TIMER_ID);
            if let Some(app) = app_handle_from(hwnd) {
                let _ = app.emit("mpv://surface-click", ());
            }
        }
        WM_MOUSEMOVE => {
            // Ignore synthetic redeliveries that report the exact same
            // position as last time (see LAST_MOUSE_POS) - only a real
            // change in position counts as "the mouse moved".
            let xy = lparam.0 as u32;
            let x = (xy & 0xFFFF) as u16 as i16 as i32;
            let y = ((xy >> 16) & 0xFFFF) as u16 as i16 as i32;
            let packed = pack_pos(x, y);
            let moved = LAST_MOUSE_POS.swap(packed, Ordering::Relaxed) != packed;

            if moved {
                // Show the cursor immediately on movement rather than waiting
                // for the next WM_SETCURSOR - it fires from this same message,
                // so waiting for it would mean showing the cursor one frame
                // late at best.
                if CURSOR_HIDDEN.swap(false, Ordering::SeqCst) {
                    apply_cursor_visibility(false);
                }
                let now = now_ms();
                let last = LAST_MOUSEMOVE_EMIT_MS.load(Ordering::Relaxed);
                if now.saturating_sub(last) >= MOUSEMOVE_THROTTLE_MS {
                    LAST_MOUSEMOVE_EMIT_MS.store(now, Ordering::Relaxed);
                    if let Some(app) = app_handle_from(hwnd) {
                        let _ = app.emit("mpv://surface-mousemove", ());
                    }
                }
            }
        }
        WM_SETCURSOR => {
            apply_cursor_visibility(CURSOR_HIDDEN.load(Ordering::Relaxed));
            return LRESULT(1);
        }
        WM_MOUSEWHEEL => {
            if let Some(app) = app_handle_from(hwnd) {
                // The wheel delta is a signed 16-bit value in the high word
                // of wparam, in multiples of WHEEL_DELTA (120) per notch.
                let raw = ((wparam.0 >> 16) & 0xFFFF) as u16 as i16;
                let notches = f64::from(raw) / 120.0;
                let _ = app.emit("mpv://surface-wheel", json!({ "notches": notches }));
            }
        }
        WM_DESTROY => {
            // Reclaim and drop the boxed AppHandle we stashed at creation.
            let ptr = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *mut AppHandle;
            if !ptr.is_null() {
                drop(Box::from_raw(ptr));
            }
        }
        _ => {}
    }
    DefWindowProcW(hwnd, msg, wparam, lparam)
}

unsafe fn app_handle_from(hwnd: HWND) -> Option<AppHandle> {
    let ptr = GetWindowLongPtrW(hwnd, GWLP_USERDATA) as *const AppHandle;
    ptr.as_ref().cloned()
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Creates a native child window embedded inside the given parent HWND. mpv
/// renders its video output directly into this window via `--wid`, since the
/// WebView2 surface cannot host GPU output from an external process.
///
/// Because this window sits above the webview in z-order (otherwise the
/// video would never be visible), it also intercepts clicks, double-clicks,
/// mouse movement and scroll events over that screen area - `wnd_proc`
/// forwards those to the frontend as Tauri events (click-to-toggle-play-
/// pause, double-click-to-fullscreen, mouse-move for the fullscreen
/// auto-hide control bar, scroll-to-adjust-volume) instead of letting them
/// silently disappear into `DefWindowProcW`.
pub fn create_video_surface(app: AppHandle, parent: isize) -> isize {
    unsafe {
        let class_name = wide(CLASS_NAME);
        let wc = WNDCLASSW {
            style: CS_HREDRAW | CS_VREDRAW | CS_DBLCLKS,
            lpfnWndProc: Some(wnd_proc),
            hInstance: windows::Win32::System::LibraryLoader::GetModuleHandleW(PCWSTR::null())
                .unwrap_or_default()
                .into(),
            lpszClassName: PCWSTR(class_name.as_ptr()),
            ..Default::default()
        };
        // Ignore "class already exists" errors on subsequent windows.
        let _ = RegisterClassW(&wc);

        // Created hidden and zero-sized: it only overlays the webview once
        // media is actually loaded, see `resize_video_surface`. Starting at
        // a non-zero size/position here would risk it briefly covering
        // other UI (e.g. the titlebar) before the first real layout sync.
        let hwnd = CreateWindowExW(
            Default::default(),
            PCWSTR(class_name.as_ptr()),
            PCWSTR::null(),
            WS_CHILD,
            0,
            0,
            0,
            0,
            HWND(parent as *mut _),
            None,
            None,
            None,
        )
        .expect("failed to create mpv video surface window");

        let _ = SetParent(hwnd, HWND(parent as *mut _));
        let _ = ShowWindow(hwnd, SW_HIDE);

        let app_ptr = Box::into_raw(Box::new(app));
        SetWindowLongPtrW(hwnd, GWLP_USERDATA, app_ptr as isize);

        hwnd.0 as isize
    }
}

/// Resizes and repositions the native video surface. A zero-sized rect hides
/// it entirely, which is used while no media is loaded so the webview
/// underneath (e.g. the "Open File" prompt, drag-and-drop) remains
/// clickable.
pub fn resize_video_surface(hwnd: isize, x: i32, y: i32, width: i32, height: i32) {
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowPos, SWP_NOZORDER};
    unsafe {
        let handle = HWND(hwnd as *mut _);
        let _ = SetWindowPos(handle, None, x, y, width, height, SWP_NOZORDER);
        let _ = ShowWindow(handle, if width > 0 && height > 0 { SW_SHOW } else { SW_HIDE });
    }
}

/// Alpha value applied while dimmed (0 = fully transparent, 255 = opaque).
/// Blended by the DWM compositor against whatever's directly behind this
/// window - the settings dialog's own dark backdrop - so the video reads as
/// "dimmed underneath a modal" without mpv's decoder/renderer ever being
/// touched.
const DIM_ALPHA: u8 = 160;

/// Dims (or restores) the video by toggling `WS_EX_LAYERED` and blending the
/// whole native surface via `SetLayeredWindowAttributes` - a compositor-level
/// tint, not a change to mpv's own rendering, so it costs nothing extra on
/// the GPU/CPU and takes effect immediately. Used while a large overlay
/// (Settings and its tabs) is open, satisfying "dim the video, never black
/// it out" without mpv's swapchain ever stopping or being reconfigured.
pub fn set_video_surface_dim(hwnd: isize, dimmed: bool) {
    unsafe {
        let handle = HWND(hwnd as *mut _);
        let ex_style = GetWindowLongW(handle, GWL_EXSTYLE) as u32;
        if dimmed {
            let _ = SetWindowLongW(handle, GWL_EXSTYLE, (ex_style | WS_EX_LAYERED.0) as i32);
            let _ = SetLayeredWindowAttributes(handle, COLORREF(0), DIM_ALPHA, LWA_ALPHA);
        } else {
            let _ = SetWindowLongW(handle, GWL_EXSTYLE, (ex_style & !WS_EX_LAYERED.0) as i32);
        }
    }
}

/// Clips a rectangular hole out of the video surface's paintable region
/// (window-relative, physical pixels) instead of hiding or zero-sizing the
/// window - which is what this replaces for the "menu/settings overlay is
/// open" case (see `uiStore`'s doc comment for why that used to be handled
/// by hiding, and why that was wrong). mpv renders into this window via its
/// own Direct3D swapchain; hiding it (or resizing it to 0x0) stops that
/// swapchain from presenting, and on at least one tested GPU/driver
/// combination that stalled mpv's whole pipeline - audio included - not just
/// the picture. Clipping a region leaves the window fully visible and
/// full-sized the entire time, so mpv keeps decoding, rendering and
/// presenting without interruption; it's simply not painted in the area an
/// overlay occupies.
///
/// Pass `exclude_width`/`exclude_height` <= 0 to clear the clip (full video
/// visible again).
pub fn set_video_surface_exclusion(
    hwnd: isize,
    width: i32,
    height: i32,
    exclude_x: i32,
    exclude_y: i32,
    exclude_width: i32,
    exclude_height: i32,
) {
    unsafe {
        let handle = HWND(hwnd as *mut _);
        if exclude_width <= 0 || exclude_height <= 0 {
            let _ = SetWindowRgn(handle, None, true);
            return;
        }
        let full = CreateRectRgn(0, 0, width, height);
        let hole = CreateRectRgn(exclude_x, exclude_y, exclude_x + exclude_width, exclude_y + exclude_height);
        CombineRgn(full, full, hole, RGN_DIFF);
        // SetWindowRgn takes ownership of `full` on success; only `hole` is ours to delete.
        let _ = SetWindowRgn(handle, full, true);
        let _ = DeleteObject(hole);
    }
}
