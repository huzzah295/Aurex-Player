import { usePlayerStore } from "../stores/playerStore";
import { playbackService } from "../services/playbackService";

const VOLUME_STEP_PER_NOTCH = 0.05;

/** Adjusts volume by `notches` mouse-wheel units (positive = up), clamped to [0, 1]. */
export function adjustVolumeByNotches(notches: number) {
  const store = usePlayerStore.getState();
  if (store.state === "idle") return;
  const delta = notches * VOLUME_STEP_PER_NOTCH;
  const nextVolume = Math.min(1, Math.max(0, (store.muted ? 0 : store.volume) + delta));
  store.setVolume(nextVolume);
  void playbackService.setVolume(nextVolume);
  if (store.muted) void playbackService.setMuted(false);
}
