import { create } from "zustand";
import { DEFAULT_SHORTCUTS, type ShortcutAction } from "../lib/shortcuts";

export type ThemeMode = "dark" | "light" | "oled" | "glass" | "midnight" | "sunset";
export type AccentColor = "blue" | "purple" | "green" | "orange" | "red";

interface Persisted {
  theme: ThemeMode;
  accent: AccentColor;
  onboardingComplete: boolean;
  skipIntervalSeconds: number;
  shortcuts: Record<ShortcutAction, string>;
  alwaysOnTop: boolean;
  lastOpenedFolder: string | null;
  dynamicAccentEnabled: boolean;
  showAdvancedSettings: boolean;
  autoCheckForUpdates: boolean;
}

interface SettingsStore extends Persisted {
  setTheme: (theme: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  setSkipIntervalSeconds: (seconds: number) => void;
  setShortcut: (action: ShortcutAction, combo: string) => void;
  resetShortcuts: () => void;
  setAlwaysOnTop: (alwaysOnTop: boolean) => void;
  setLastOpenedFolder: (folder: string) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  setDynamicAccentEnabled: (enabled: boolean) => void;
  setShowAdvancedSettings: (show: boolean) => void;
  setAutoCheckForUpdates: (enabled: boolean) => void;
}

const STORAGE_KEY = "aurex-settings";
const DEFAULTS: Persisted = {
  theme: "dark",
  accent: "blue",
  onboardingComplete: false,
  skipIntervalSeconds: 10,
  shortcuts: DEFAULT_SHORTCUTS,
  alwaysOnTop: false,
  lastOpenedFolder: null,
  dynamicAccentEnabled: false,
  showAdvancedSettings: false,
  autoCheckForUpdates: true,
};

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function loadInitial(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULTS,
        ...parsed,
        shortcuts: { ...DEFAULT_SHORTCUTS, ...parsed.shortcuts },
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return DEFAULTS;
}

function persist(state: Persisted) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function applyDom(theme: ThemeMode, accent: AccentColor) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = accent;
}

/**
 * Rounds the main window's corners at the OS level (Windows 11 DWM API)
 * while Liquid Glass is active - a small native touch, not a switch to a
 * transparent-window architecture for every theme. Best-effort: silently
 * no-ops on Windows 10 or if the call fails for any other reason.
 */
async function applyWindowRounding(theme: ThemeMode) {
  if (!isTauri) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_window_rounded", { rounded: theme === "glass" });
  } catch {
    // Unsupported on this Windows version, or window not ready yet - fine.
  }
}

/** Best-effort - mirrors applyWindowRounding's silent-fail approach. */
async function applyAlwaysOnTop(alwaysOnTop: boolean) {
  if (!isTauri) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setAlwaysOnTop(alwaysOnTop);
  } catch {
    // Window not ready yet, or unsupported - fine.
  }
}

/**
 * Toggles the Rust-side sampler (accent_color.rs) that installs/removes an
 * mpv `signalstats` filter and periodically reports the playing video's
 * average color. Best-effort - mpv may not be connected yet.
 */
async function applyDynamicAccentEnabled(enabled: boolean) {
  if (!isTauri) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("set_dynamic_accent_enabled", { enabled });
  } catch {
    // mpv not ready yet - fine, the toggle can be flipped again later.
  }
}

/**
 * Registered once, for the lifetime of the window, regardless of whether the
 * feature is currently enabled - the handler itself checks the live
 * `dynamicAccentEnabled` flag before touching anything, so this is a no-op
 * until a user actually opts in. Applies the sampled color as an inline
 * `--accent` override on top of the static `data-accent` theme variable
 * (removed again in `setDynamicAccentEnabled` below when turned off).
 */
async function listenForDynamicAccentColor() {
  if (!isTauri) return;
  try {
    const { listen } = await import("@tauri-apps/api/event");
    await listen<{ r: number; g: number; b: number }>("accent-color://update", (event) => {
      if (!useSettingsStore.getState().dynamicAccentEnabled) return;
      const { r, g, b } = event.payload;
      document.documentElement.style.setProperty("--accent", `${r} ${g} ${b}`);
    });
  } catch {
    // Event system not ready - fine, dynamic accent just won't update this session.
  }
}

const initial = loadInitial();
applyDom(initial.theme, initial.accent);
void applyWindowRounding(initial.theme);
void applyAlwaysOnTop(initial.alwaysOnTop);
void applyDynamicAccentEnabled(initial.dynamicAccentEnabled);
void listenForDynamicAccentColor();

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...initial,

  setTheme: (theme) => {
    applyDom(theme, get().accent);
    void applyWindowRounding(theme);
    set({ theme });
    persist({ ...get(), theme });
  },

  setAccent: (accent) => {
    applyDom(get().theme, accent);
    set({ accent });
    persist({ ...get(), accent });
  },

  setSkipIntervalSeconds: (skipIntervalSeconds) => {
    set({ skipIntervalSeconds });
    persist({ ...get(), skipIntervalSeconds });
  },

  setShortcut: (action, combo) => {
    const shortcuts = { ...get().shortcuts, [action]: combo };
    set({ shortcuts });
    persist({ ...get(), shortcuts });
  },

  resetShortcuts: () => {
    set({ shortcuts: DEFAULT_SHORTCUTS });
    persist({ ...get(), shortcuts: DEFAULT_SHORTCUTS });
  },

  setAlwaysOnTop: (alwaysOnTop) => {
    void applyAlwaysOnTop(alwaysOnTop);
    set({ alwaysOnTop });
    persist({ ...get(), alwaysOnTop });
  },

  setLastOpenedFolder: (lastOpenedFolder) => {
    set({ lastOpenedFolder });
    persist({ ...get(), lastOpenedFolder });
  },

  completeOnboarding: () => {
    set({ onboardingComplete: true });
    persist({ ...get(), onboardingComplete: true });
  },

  resetOnboarding: () => {
    set({ onboardingComplete: false });
    persist({ ...get(), onboardingComplete: false });
  },

  setDynamicAccentEnabled: (dynamicAccentEnabled) => {
    void applyDynamicAccentEnabled(dynamicAccentEnabled);
    if (!dynamicAccentEnabled) {
      // Drop back to the static theme accent immediately - otherwise the
      // last-sampled inline override would keep winning over data-accent.
      document.documentElement.style.removeProperty("--accent");
    }
    set({ dynamicAccentEnabled });
    persist({ ...get(), dynamicAccentEnabled });
  },

  setShowAdvancedSettings: (showAdvancedSettings) => {
    set({ showAdvancedSettings });
    persist({ ...get(), showAdvancedSettings });
  },

  setAutoCheckForUpdates: (autoCheckForUpdates) => {
    set({ autoCheckForUpdates });
    persist({ ...get(), autoCheckForUpdates });
  },
}));
