import { usePlayerStore } from "../stores/playerStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useUiStore } from "../stores/uiStore";
import { playbackService } from "../services/playbackService";
import type { RepeatMode } from "../types/player";

const NEXT_REPEAT_MODE: Record<RepeatMode, RepeatMode> = {
  off: "all",
  all: "one",
  one: "off",
};

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Actions shared between the transport control bar, keyboard shortcuts, and
 * (for volume) mouse-wheel handling - kept in one place so all three
 * trigger points stay in sync instead of re-implementing the same logic.
 */

export function togglePlayPause() {
  if (usePlayerStore.getState().state === "idle") return;
  void playbackService.togglePlayPause();
}

export function skipBy(deltaSeconds: number) {
  const store = usePlayerStore.getState();
  if (store.state === "idle") return;
  store.setPosition(Math.max(0, Math.min(store.durationSeconds || 0, store.positionSeconds + deltaSeconds)));
  void playbackService.seekRelative(deltaSeconds);
}

export function skipByDefaultInterval(direction: 1 | -1) {
  skipBy(direction * useSettingsStore.getState().skipIntervalSeconds);
}

// Fixed independently of the user-configurable skip interval (which governs
// the transport bar's skip-back/skip-forward buttons) - the arrow keys always
// seek by exactly this much.
const ARROW_SEEK_SECONDS = 5;

export function seekByArrowKey(direction: 1 | -1) {
  skipBy(direction * ARROW_SEEK_SECONDS);
}

export function toggleMute() {
  const store = usePlayerStore.getState();
  store.toggleMute();
  void playbackService.setMuted(!store.muted);
}

export function cycleRepeatMode() {
  const store = usePlayerStore.getState();
  store.setRepeatMode(NEXT_REPEAT_MODE[store.repeatMode]);
}

export function toggleShuffle() {
  usePlayerStore.getState().toggleShuffle();
}

export function nextTrack() {
  usePlayerStore.getState().next();
}

export function previousTrack() {
  usePlayerStore.getState().previous();
}

// Whether the window was in a restored (non-maximized) state before we
// maximized it to work around the issue below. Module-level rather than
// per-call since it needs to survive from the "enter" call to the later
// "exit" call.
let wasRestoredBeforeFullscreen = false;

export async function toggleFullscreen() {
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const win = getCurrentWindow();
  const nextFullscreen = !(await win.isFullscreen());

  if (nextFullscreen) {
    // With decorations disabled (our custom titlebar), entering fullscreen
    // from a restored/floating window is unreliable on Windows - a known
    // tao/tauri quirk (https://github.com/tauri-apps/tauri/issues/11788)
    // that only reproduces from a non-maximized starting state. Maximizing
    // first gives it a consistent geometry to transition from.
    wasRestoredBeforeFullscreen = !(await win.isMaximized());
    if (wasRestoredBeforeFullscreen) await win.maximize();
    await win.setFullscreen(true);
  } else {
    await win.setFullscreen(false);
    if (wasRestoredBeforeFullscreen) await win.unmaximize();
  }

  useUiStore.getState().setFullscreen(nextFullscreen);
}
