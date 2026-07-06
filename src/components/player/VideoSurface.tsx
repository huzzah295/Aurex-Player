import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePlayerStore } from "../../stores/playerStore";
import { useTauriFileDrop } from "../../hooks/useTauriFileDrop";
import { useVideoSurfaceSync } from "../../hooks/useVideoSurfaceSync";
import { useVideoSurfaceOverlayExclusion } from "../../hooks/useVideoSurfaceOverlayExclusion";
import { openFilesDialog, openPaths } from "../../lib/openMedia";
import { playbackService } from "../../services/playbackService";
import { toggleFullscreen } from "../../lib/playbackActions";
import { consumeSurfaceClickSuppression } from "../../lib/surfaceClickGuard";
import { FolderOpenIcon } from "../icons";
import { VolumeHud } from "./VolumeHud";
import { AudioLogoView } from "./AudioLogoView";
import { ResumePrompt } from "./ResumePrompt";

// Native DOM double-clicks still dispatch a `click` event for each of the
// two clicks (click, click, dblclick) before `dblclick` fires - toggling
// play/pause immediately on click would flicker it on every double-click.
// Delaying by this long lets a following dblclick cancel the pending toggle
// instead (mirrors the native mpv surface's WM_LBUTTONUP/WM_LBUTTONDBLCLK
// debounce in mpv_window.rs, which handles the same race for video tracks).
const CLICK_DEBOUNCE_MS = 250;

export function VideoSurface() {
  const state = usePlayerStore((s) => s.state);
  const currentTrack = usePlayerStore((s) => s.currentTrack());
  const errorMessage = usePlayerStore((s) => s.errorMessage);
  const [isDragOver, setIsDragOver] = useState(false);
  const pendingClickRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasTrack = Boolean(currentTrack);
  const isAudioOnly = hasTrack && currentTrack!.isVideo === false;
  // The native mpv window only needs to be shown (and only then does it sit
  // above the webview, intercepting input) when there's an actual video
  // stream to render. For audio-only tracks it stays fully hidden, same as
  // when idle - which also means the app menu and every other click target
  // stay reachable during audio playback exactly as they do when nothing is
  // loaded at all.
  //
  // It otherwise stays fully active - including while the app menu or
  // settings dialog is open. Those overlays are excluded from the surface's
  // paintable/hit-testable region instead (see useVideoSurfaceOverlayExclusion)
  // rather than hiding or zero-sizing the whole window: that used to stop
  // mpv's swapchain from presenting, and on at least one tested GPU/driver
  // combination that stalled playback and audio too, not just the picture.
  const surfaceActive = hasTrack && !isAudioOnly && state !== "error";
  const surfaceRef = useVideoSurfaceSync<HTMLDivElement>(surfaceActive);
  useVideoSurfaceOverlayExclusion(surfaceRef);

  useTauriFileDrop(
    useCallback((paths) => {
      setIsDragOver(false);
      openPaths(paths);
    }, []),
  );

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Real paths are resolved via useTauriFileDrop; this just prevents the
    // browser from navigating to the dropped file.
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  return (
    <div
      ref={surfaceRef}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      onClick={() => {
        // Video tracks: the native mpv window covers this area and forwards
        // its own click event (see useSurfaceInput). Audio tracks: no native
        // window is shown here at all, so handle the click directly - delayed
        // so a following double-click can cancel it (see CLICK_DEBOUNCE_MS).
        if (consumeSurfaceClickSuppression()) return;
        if (!isAudioOnly) return;
        if (pendingClickRef.current) clearTimeout(pendingClickRef.current);
        pendingClickRef.current = setTimeout(() => {
          pendingClickRef.current = null;
          void playbackService.togglePlayPause();
        }, CLICK_DEBOUNCE_MS);
      }}
      onDoubleClick={() => {
        if (!isAudioOnly || !hasTrack) return;
        if (pendingClickRef.current) {
          clearTimeout(pendingClickRef.current);
          pendingClickRef.current = null;
        }
        void toggleFullscreen();
      }}
      className={`relative flex flex-1 items-center justify-center bg-black shadow-[inset_0_0_0_0px_rgb(var(--accent)/0)] transition-shadow duration-200 ease-out ${
        isDragOver ? "shadow-[inset_0_0_0_2px_rgb(var(--accent))]" : ""
      }`}
    >
      {/* The native mpv render surface is embedded here by the Tauri backend
          (video tracks only - see surfaceActive above). */}
      <AnimatePresence mode="wait">
        {(!currentTrack || state === "error") && (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="flex flex-col items-center gap-5 text-[rgb(var(--text-muted))]"
          >
            {state === "error" && (
              <div className="max-w-md rounded-md bg-[rgb(var(--bg-elevated))] px-4 py-2 text-sm text-[rgb(var(--danger))]">
                {errorMessage ?? "Playback error"}
              </div>
            )}
            <FolderOpenIcon className="h-9 w-9 opacity-40" />
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm">Drag and drop media here, or</p>
              <motion.button
                onClick={() => void openFilesDialog()}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="glass-btn cursor-pointer rounded-md bg-[rgb(var(--bg-hover))] px-4 py-2 text-sm font-medium text-[rgb(var(--text))] transition-colors duration-150 hover:bg-[rgb(var(--accent))] hover:text-white"
              >
                Open File
              </motion.button>
            </div>
          </motion.div>
        )}
        {isAudioOnly && state !== "error" && (
          <motion.div
            key="audio-logo"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <AudioLogoView title={currentTrack!.title} playing={state === "playing"} />
          </motion.div>
        )}
      </AnimatePresence>
      {state === "loading" && currentTrack && (
        <div className="absolute text-sm text-[rgb(var(--text-muted))]">Loading {currentTrack.title}…</div>
      )}
      <VolumeHud />
      <ResumePrompt />
    </div>
  );
}
