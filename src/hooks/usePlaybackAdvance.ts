import { useEffect } from "react";
import { usePlayerStore } from "../stores/playerStore";
import { playbackService } from "../services/playbackService";

/**
 * Reacts to mpv reporting end-of-file: loops the current track for
 * Repeat One, otherwise advances the playlist (respecting Repeat All /
 * shuffle, both already implemented in the store's `next()`).
 */
export function usePlaybackAdvance() {
  useEffect(() => {
    return usePlayerStore.subscribe((state, prevState) => {
      if (state.state !== "ended" || prevState.state === "ended") return;

      if (state.repeatMode === "one") {
        void playbackService.seek(0).then(() => playbackService.play());
      } else {
        usePlayerStore.getState().next();
      }
    });
  }, []);
}
