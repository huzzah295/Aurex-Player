import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { TitleBar } from "./components/layout/TitleBar";
import { VideoSurface } from "./components/player/VideoSurface";
import { TransportControls } from "./components/player/TransportControls";
import { Onboarding } from "./components/Onboarding";
import { SettingsDialog, type SettingsTab } from "./components/settings/SettingsDialog";
import { useSettingsStore } from "./stores/settingsStore";
import { useUiStore } from "./stores/uiStore";
import { listenToPlayerEvents } from "./services/playbackService";
import { usePlaybackAdvance } from "./hooks/usePlaybackAdvance";
import { useOpenFileFromOS } from "./hooks/useOpenFileFromOS";
import { useSurfaceInput } from "./hooks/useSurfaceInput";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useFullscreenChrome } from "./hooks/useFullscreenChrome";
import { useAutoUpdateCheck } from "./hooks/useAutoUpdateCheck";
import { adjustVolumeByNotches } from "./lib/volume";

function App() {
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  const isFullscreen = useUiStore((s) => s.isFullscreen);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listenToPlayerEvents().then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  // Fades out and removes the static pre-React splash (see index.html) now
  // that the real UI has actually mounted - runs once, regardless of which
  // branch (Onboarding vs the main player) ends up rendering below.
  useEffect(() => {
    const splash = document.getElementById("aurex-splash");
    if (!splash) return;
    splash.classList.add("aurex-splash-hidden");
    const timeout = setTimeout(() => splash.remove(), 250);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    // mpv's video renders in a native window that always sits above the
    // webview, so it would otherwise cover the lower portion of this
    // dialog whenever a video is actively playing (see VideoSurface).
    useUiStore.getState().setSettingsOpen(settingsTab !== null);
  }, [settingsTab]);

  usePlaybackAdvance();
  useOpenFileFromOS();
  useSurfaceInput();
  useFullscreenChrome();
  useAutoUpdateCheck();
  // Suspended while Settings is open so the shortcut-rebind capture there
  // doesn't fight with global shortcuts also reacting to the same keypress.
  useKeyboardShortcuts(settingsTab !== null);

  if (!onboardingComplete) {
    return (
      <div className="flex h-full flex-col">
        <Onboarding />
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full flex-col"
      onWheel={(e) => {
        if (settingsTab) return;
        adjustVolumeByNotches(-Math.sign(e.deltaY));
      }}
    >
      {!isFullscreen && (
        <TitleBar
          onOpenSettings={() => setSettingsTab("general")}
          onOpenShortcuts={() => setSettingsTab("shortcuts")}
          onOpenEqualizer={() => setSettingsTab("equalizer")}
          onOpenAbout={() => setSettingsTab("about")}
          onOpenUpdates={() => setSettingsTab("updates")}
        />
      )}
      <VideoSurface />
      {/* In fullscreen, the transport bar renders in its own overlay window
          instead (see FullscreenControlsWindow.tsx / useFullscreenChrome) so
          it can float over the video without shrinking it. */}
      {!isFullscreen && <TransportControls />}
      <AnimatePresence>
        {settingsTab && (
          <SettingsDialog key="settings-dialog" initialTab={settingsTab} onClose={() => setSettingsTab(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
