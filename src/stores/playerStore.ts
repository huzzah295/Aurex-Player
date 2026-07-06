import { create } from "zustand";
import type { MediaTrack, PlaybackState, RepeatMode } from "../types/player";
import { playbackService } from "../services/playbackService";
import { getSavedProgress } from "../lib/watchHistory";
import { useEqualizerStore } from "./equalizerStore";

// Key name predates speed/repeat/shuffle persistence being added here, but is
// kept as-is (rather than renamed to something more general) so existing
// installs don't lose their saved volume.
const VOLUME_STORAGE_KEY = "aurex-volume";

interface PersistedPlaybackPrefs {
  volume: number;
  muted: boolean;
  speed: number;
  repeatMode: RepeatMode;
  shuffle: boolean;
}

const REPEAT_MODES: RepeatMode[] = ["off", "one", "all"];

function loadPersistedPlaybackPrefs(): PersistedPlaybackPrefs {
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.volume === "number") {
        return {
          volume: Math.min(1, Math.max(0, parsed.volume)),
          muted: Boolean(parsed.muted),
          speed: typeof parsed.speed === "number" && parsed.speed > 0 ? parsed.speed : 1,
          repeatMode: REPEAT_MODES.includes(parsed.repeatMode) ? parsed.repeatMode : "off",
          shuffle: Boolean(parsed.shuffle),
        };
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return { volume: 1, muted: false, speed: 1, repeatMode: "off", shuffle: false };
}

function persistPlaybackPrefs(prefs: PersistedPlaybackPrefs) {
  localStorage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(prefs));
}

export interface ResumePrompt {
  path: string;
  title: string;
  resumeSeconds: number;
}

interface PlayerStore {
  playlist: MediaTrack[];
  currentIndex: number;
  state: PlaybackState;
  positionSeconds: number;
  durationSeconds: number;
  volume: number;
  muted: boolean;
  speed: number;
  repeatMode: RepeatMode;
  shuffle: boolean;
  errorMessage?: string;
  resumePrompt: ResumePrompt | null;

  currentTrack: () => MediaTrack | undefined;
  setPlaylist: (tracks: MediaTrack[], startIndex?: number) => void;
  openTrackAtIndex: (index: number) => void;
  setState: (state: PlaybackState) => void;
  setPosition: (seconds: number) => void;
  setDuration: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setSpeed: (speed: number) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  next: () => void;
  previous: () => void;
  setError: (message?: string) => void;
  confirmResume: () => void;
  dismissResume: () => void;
}

const persisted = loadPersistedPlaybackPrefs();

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  playlist: [],
  currentIndex: -1,
  state: "idle",
  positionSeconds: 0,
  durationSeconds: 0,
  volume: persisted.volume,
  muted: persisted.muted,
  speed: persisted.speed,
  repeatMode: persisted.repeatMode,
  shuffle: persisted.shuffle,
  errorMessage: undefined,
  resumePrompt: null,

  currentTrack: () => {
    const { playlist, currentIndex } = get();
    return playlist[currentIndex];
  },

  setPlaylist: (tracks, startIndex = 0) => {
    set({ playlist: tracks, currentIndex: tracks.length ? startIndex : -1 });
    if (tracks.length) get().openTrackAtIndex(startIndex);
  },

  openTrackAtIndex: (index) => {
    const track = get().playlist[index];
    if (!track) return;
    set({ currentIndex: index, positionSeconds: 0, errorMessage: undefined, resumePrompt: null });
    void playbackService.open(track.path);
    // Re-apply the persisted volume/mute/speed preference to mpv on every
    // track open - the mpv sidecar itself defaults to full volume/1x speed on
    // each launch and has no memory of prior tracks, so this is what makes
    // the app's remembered preferences actually take effect on the backend.
    const { volume, muted, speed } = get();
    void playbackService.setVolume(muted ? 0 : volume);
    void playbackService.setMuted(muted);
    void playbackService.setSpeed(speed);
    const eq = useEqualizerStore.getState();
    void playbackService.setEqualizer(eq.bands, eq.enabled);

    const saved = getSavedProgress(track.path);
    if (saved) {
      set({ resumePrompt: { path: track.path, title: track.title, resumeSeconds: saved } });
      void playbackService.pause();
    } else {
      // mpv's `pause` property is sticky across `loadfile` - if the user had
      // paused a previous track, a newly opened one would otherwise load and
      // sit there paused instead of starting playback on its own, requiring
      // an extra click. Explicitly starting playback here is what makes
      // "double-click a file" / "open a file" always begin playing
      // immediately, regardless of whatever the pause state happened to be.
      void playbackService.play();
    }
  },

  setState: (state) => set({ state }),
  setPosition: (positionSeconds) => set({ positionSeconds }),
  setDuration: (durationSeconds) => set({ durationSeconds }),
  setVolume: (volume) => {
    const muted = volume === 0;
    set({ volume, muted });
    const { speed, repeatMode, shuffle } = get();
    persistPlaybackPrefs({ volume, muted, speed, repeatMode, shuffle });
  },
  toggleMute: () => {
    const { volume, muted, speed, repeatMode, shuffle } = get();
    const nextMuted = !muted;
    set({ muted: nextMuted });
    persistPlaybackPrefs({ volume, muted: nextMuted, speed, repeatMode, shuffle });
  },
  setSpeed: (speed) => {
    set({ speed });
    const { volume, muted, repeatMode, shuffle } = get();
    persistPlaybackPrefs({ volume, muted, speed, repeatMode, shuffle });
  },
  setRepeatMode: (repeatMode) => {
    set({ repeatMode });
    const { volume, muted, speed, shuffle } = get();
    persistPlaybackPrefs({ volume, muted, speed, repeatMode, shuffle });
  },
  toggleShuffle: () => {
    const { volume, muted, speed, repeatMode, shuffle } = get();
    const nextShuffle = !shuffle;
    set({ shuffle: nextShuffle });
    persistPlaybackPrefs({ volume, muted, speed, repeatMode, shuffle: nextShuffle });
  },

  confirmResume: () => {
    const { resumePrompt } = get();
    if (!resumePrompt) return;
    set({ resumePrompt: null, positionSeconds: resumePrompt.resumeSeconds });
    void playbackService.seek(resumePrompt.resumeSeconds);
    void playbackService.play();
  },

  dismissResume: () => {
    if (!get().resumePrompt) return;
    set({ resumePrompt: null });
    void playbackService.play();
  },

  next: () => {
    const { playlist, currentIndex, shuffle, repeatMode, openTrackAtIndex } = get();
    if (!playlist.length) return;
    if (shuffle) {
      openTrackAtIndex(Math.floor(Math.random() * playlist.length));
      return;
    }
    const isLast = currentIndex >= playlist.length - 1;
    if (isLast && repeatMode !== "all") return;
    openTrackAtIndex((currentIndex + 1) % playlist.length);
  },

  previous: () => {
    const { playlist, currentIndex, openTrackAtIndex } = get();
    if (!playlist.length) return;
    const prevIndex = currentIndex <= 0 ? playlist.length - 1 : currentIndex - 1;
    openTrackAtIndex(prevIndex);
  },

  setError: (errorMessage) => set({ errorMessage, state: errorMessage ? "error" : get().state }),
}));
