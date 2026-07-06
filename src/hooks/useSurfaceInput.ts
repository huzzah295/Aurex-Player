import { useEffect } from "react";
import { usePlayerStore } from "../stores/playerStore";
import { useUiStore } from "../stores/uiStore";
import { playbackService } from "../services/playbackService";
import { adjustVolumeByNotches } from "../lib/volume";
import { toggleFullscreen } from "../lib/playbackActions";
import { pulseFullscreenControls } from "../lib/fullscreenControls";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * The native mpv video window sits above the webview (see mpv_window.rs), so
 * clicks, double-clicks, mouse movement, and scroll wheel events over the
 * video never reach the DOM - the OS delivers them straight to that window
 * instead. Rust's wnd_proc forwards them here as Tauri events so the
 * frontend still owns the actual behavior: click anywhere on the video to
 * toggle play/pause, double-click to toggle fullscreen, scroll to adjust
 * volume, and mouse movement to reveal the fullscreen auto-hide control bar.
 */
export function useSurfaceInput() {
  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    const unlisten: Array<() => void> = [];

    (async () => {
      const { listen } = await import("@tauri-apps/api/event");

      const clickUnlisten = await listen("mpv://surface-click", () => {
        if (useUiStore.getState().isFullscreen) void pulseFullscreenControls();

        // The native video window sits above the webview, so a click landing
        // outside the app menu's dropdown (itself excluded from that native
        // window's hit-test region, see useVideoSurfaceOverlayExclusion)
        // never reaches the DOM at all - meaning the menu's own "click
        // outside to close" listener never fires for it. Absorb this first
        // click into "just close the menu" instead, exactly like clicking
        // outside it anywhere else in the app already does, rather than
        // letting it fall through to toggling playback.
        if (useUiStore.getState().menuOpen) {
          useUiStore.getState().setMenuOpen(false);
          return;
        }
        if (usePlayerStore.getState().state === "idle") return;
        void playbackService.togglePlayPause();
      });

      const dblclickUnlisten = await listen("mpv://surface-dblclick", () => {
        if (usePlayerStore.getState().state === "idle") return;
        void toggleFullscreen();
      });

      const mousemoveUnlisten = await listen("mpv://surface-mousemove", () => {
        if (useUiStore.getState().isFullscreen) void pulseFullscreenControls();
      });

      const wheelUnlisten = await listen<{ notches: number }>("mpv://surface-wheel", (event) => {
        if (useUiStore.getState().isFullscreen) void pulseFullscreenControls();
        adjustVolumeByNotches(event.payload.notches);
      });

      if (cancelled) {
        clickUnlisten();
        dblclickUnlisten();
        mousemoveUnlisten();
        wheelUnlisten();
        return;
      }
      unlisten.push(clickUnlisten, dblclickUnlisten, mousemoveUnlisten, wheelUnlisten);
    })();

    return () => {
      cancelled = true;
      unlisten.forEach((fn) => fn());
    };
  }, []);
}
