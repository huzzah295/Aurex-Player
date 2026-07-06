import { useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { usePlayerStore } from "../stores/playerStore";
import { comboFromEvent, type ShortcutAction } from "../lib/shortcuts";
import { adjustVolumeByNotches } from "../lib/volume";
import {
  cycleRepeatMode,
  nextTrack,
  previousTrack,
  seekByArrowKey,
  toggleFullscreen,
  toggleMute,
  togglePlayPause,
  toggleShuffle,
} from "../lib/playbackActions";

const ACTION_HANDLERS: Record<ShortcutAction, () => void> = {
  playPause: togglePlayPause,
  seekBackward: () => seekByArrowKey(-1),
  seekForward: () => seekByArrowKey(1),
  volumeUp: () => adjustVolumeByNotches(1),
  volumeDown: () => adjustVolumeByNotches(-1),
  toggleMute: toggleMute,
  toggleFullscreen: () => void toggleFullscreen(),
  nextTrack: nextTrack,
  previousTrack: previousTrack,
  cycleRepeat: cycleRepeatMode,
  toggleShuffle: toggleShuffle,
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

/**
 * Global shortcut listener. Disabled entirely while `suspended` is true
 * (used by the Settings rebind UI, which needs to capture the very next
 * keypress itself rather than have it trigger playback actions).
 */
export function useKeyboardShortcuts(suspended: boolean) {
  useEffect(() => {
    if (suspended) return;

    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const combo = comboFromEvent(e);
      const shortcuts = useSettingsStore.getState().shortcuts;
      const action = (Object.keys(shortcuts) as ShortcutAction[]).find((key) => shortcuts[key] === combo);
      if (!action) return;

      // Fullscreen and shuffle/repeat are always available; everything else
      // needs a track loaded.
      if (action !== "toggleFullscreen" && usePlayerStore.getState().state === "idle") return;

      e.preventDefault();
      ACTION_HANDLERS[action]();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [suspended]);
}
