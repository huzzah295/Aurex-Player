import { useEffect, useRef, useState } from "react";
import { TransportControls } from "../components/player/TransportControls";
import { listenToPlayerEvents } from "../services/playbackService";
import { pulseFullscreenControls, setFullscreenControlsSuspended } from "../lib/fullscreenControls";

/**
 * The transport bar, rendered in its own always-on-top window while
 * fullscreen (see fullscreen_bar_window.rs). mpv's video renders in a native
 * window that always sits above the main window's webview, so a normal
 * in-page bar could only ever appear "in front of" a fullscreen video by
 * shrinking it out of the way first - the same reason the video-adjustments
 * popover needed its own window. This window listens to the same player
 * events as the main window, so it stays in sync automatically without any
 * bespoke state-sharing code.
 *
 * The OS-level window itself is only ever shown/hidden outright (no native
 * fade), so the visible/hidden transition is animated here via opacity
 * instead - `fullscreen_bar_window.rs` emits the target state and delays the
 * actual `window.hide()` until the fade finishes.
 *
 * The auto-hide countdown is suspended for as long as the cursor is
 * anywhere over this window (seek bar, buttons, volume slider, etc. all
 * live inside it), so it can never fade out from under an in-progress
 * interaction like dragging the seek bar.
 */
export function FullscreenControlsWindow() {
  const [visible, setVisible] = useState(true);
  // Guards against the same class of bug as mpv_window.rs's own position
  // check: showing/hiding this always-on-top window can make the OS
  // redeliver a "mousemove" at the exact same screen position (no real
  // movement) as part of recomputing what's under the cursor - treating
  // that as real movement would re-pulse, re-show, re-hide, and repeat
  // indefinitely.
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listenToPlayerEvents().then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const fn = await listen<boolean>("fullscreen-controls-visibility", (event) => {
        setVisible(event.payload);
      });
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  return (
    <div
      className={`h-screen w-screen transition-opacity duration-200 ease-out ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      onMouseMove={(e) => {
        const { screenX: x, screenY: y } = e;
        if (lastPos.current?.x === x && lastPos.current?.y === y) return;
        lastPos.current = { x, y };
        void pulseFullscreenControls();
      }}
      onMouseEnter={() => void setFullscreenControlsSuspended(true)}
      onMouseLeave={() => void setFullscreenControlsSuspended(false)}
    >
      <TransportControls />
    </div>
  );
}
