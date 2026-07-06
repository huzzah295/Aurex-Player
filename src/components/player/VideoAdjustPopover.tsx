import { SlidersIcon } from "../icons";
import { useUiStore } from "../../stores/uiStore";
import { setFullscreenControlsSuspended } from "../../lib/fullscreenControls";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const POPOVER_WIDTH = 248;
const POPOVER_HEIGHT = 300;
const RIGHT_MARGIN = 16;
const BOTTOM_MARGIN = 64; // clears the transport bar

async function invoke(cmd: string, args?: Record<string, unknown>) {
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  await tauriInvoke(cmd, args);
}

async function showPopover() {
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  const [outerPos, outerSize, scale] = await Promise.all([
    win.outerPosition(),
    win.outerSize(),
    win.scaleFactor(),
  ]);
  const x = outerPos.x / scale + outerSize.width / scale - POPOVER_WIDTH - RIGHT_MARGIN;
  const y = outerPos.y / scale + outerSize.height / scale - POPOVER_HEIGHT - BOTTOM_MARGIN;
  await invoke("show_video_adjust_popover", { x, y, width: POPOVER_WIDTH, height: POPOVER_HEIGHT });
}

async function requestHidePopover() {
  if (!isTauri) return;
  await invoke("request_hide_video_adjust_popover");
}

interface VideoAdjustPopoverProps {
  disabled: boolean;
}

/**
 * Trigger button for the video-adjustments panel. The panel itself lives in
 * a separate always-on-top window (see VideoAdjustPopoverWindow.tsx) rather
 * than as DOM content here, since mpv's video renders in a native window
 * that always sits above this one - a plain in-page popup could only appear
 * "in front of" the video by shrinking it out of the way first.
 */
export function VideoAdjustPopover({ disabled }: VideoAdjustPopoverProps) {
  return (
    <button
      disabled={disabled}
      onMouseEnter={
        disabled
          ? undefined
          : () => {
              // Keep the fullscreen bar on-screen while this popover is open -
              // otherwise moving the cursor off the trigger button and into
              // the (separate, native) popover window would read as "cursor
              // left the bar" and let the auto-hide countdown run out under it.
              if (useUiStore.getState().isFullscreen) void setFullscreenControlsSuspended(true);
              void showPopover();
            }
      }
      onMouseLeave={
        disabled
          ? undefined
          : () => {
              if (useUiStore.getState().isFullscreen) void setFullscreenControlsSuspended(false);
              void requestHidePopover();
            }
      }
      className="glass-btn flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))] disabled:opacity-30"
      aria-label="Video adjustments"
      aria-haspopup="true"
      title="Video adjustments"
    >
      <SlidersIcon className="h-4 w-4" />
    </button>
  );
}
