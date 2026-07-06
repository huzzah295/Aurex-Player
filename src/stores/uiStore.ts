import { create } from "zustand";

interface UiStore {
  menuOpen: boolean;
  settingsOpen: boolean;
  isFullscreen: boolean;
  setMenuOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setFullscreen: (fullscreen: boolean) => void;
}

/**
 * Tracks whether the app menu dropdown / settings dialog is open. mpv's
 * video renders in a native window that always sits above the webview, so
 * these overlays - which extend into the video's screen area - would
 * otherwise be covered and unclickable whenever a video is actively showing
 * there. useVideoSurfaceOverlayExclusion reads this to carve the relevant
 * area out of the native surface's region while an overlay is open, rather
 * than hiding the whole surface - playback and audio are never interrupted.
 */
export const useUiStore = create<UiStore>((set) => ({
  menuOpen: false,
  settingsOpen: false,
  isFullscreen: false,
  setMenuOpen: (menuOpen) => set({ menuOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setFullscreen: (isFullscreen) => set({ isFullscreen }),
}));
