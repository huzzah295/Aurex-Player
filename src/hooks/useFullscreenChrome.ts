import { useEffect } from "react";
import { useUiStore } from "../stores/uiStore";
import { toggleFullscreen } from "../lib/playbackActions";
import { pulseFullscreenControls } from "../lib/fullscreenControls";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Comfortably fits TransportControls' seek bar + the time-flanking row below
// it (current/duration) + button row + padding. Bumped from the original 100
// when that time row was added below the seek bar - at 100 it clipped the
// button row off the bottom of this (fixed-size, non-scrolling) window.
export const CONTROLS_BAR_HEIGHT = 132;

/**
 * Positions the fullscreen control-bar overlay window (see
 * fullscreen_bar_window.rs) whenever fullscreen is entered, hides it
 * immediately on exit, and lets Escape exit fullscreen (when no other
 * overlay - the menu, Settings - is claiming it first).
 */
export function useFullscreenChrome() {
  const isFullscreen = useUiStore((s) => s.isFullscreen);

  useEffect(() => {
    if (!isTauri) return;

    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");

      if (!isFullscreen) {
        await invoke("hide_fullscreen_controls_now");
        return;
      }

      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      const [outerPos, outerSize, scale] = await Promise.all([
        win.outerPosition(),
        win.outerSize(),
        win.scaleFactor(),
      ]);
      const x = outerPos.x / scale;
      const width = outerSize.width / scale;
      const y = outerPos.y / scale + outerSize.height / scale - CONTROLS_BAR_HEIGHT;
      await invoke("show_fullscreen_controls", { x, y, width, height: CONTROLS_BAR_HEIGHT });
    })();
  }, [isFullscreen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const isFullscreen = useUiStore.getState().isFullscreen;
      // Any keyboard shortcut counts as "something happened" for the
      // auto-hide countdown, not just Escape below - e.g. Space to
      // pause should bring the bar back even if the mouse never moved.
      if (isFullscreen) void pulseFullscreenControls();

      if (e.key !== "Escape") return;
      const { menuOpen, settingsOpen } = useUiStore.getState();
      if (menuOpen || settingsOpen) return; // let those close themselves first
      if (isFullscreen) void toggleFullscreen();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);
}
