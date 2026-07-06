/// Every localStorage key Aurex Player owns. Kept in one place so Repair
/// Mode's "corrupted settings" scan can't drift out of sync with what each
/// store actually persists under.
const OWNED_KEYS = ["aurex-settings", "aurex-volume", "aurex-equalizer", "aurex-watch-history"] as const;

function isCorrupted(key: string): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return false;
  try {
    JSON.parse(raw);
    return false;
  } catch {
    return true;
  }
}

/**
 * Removes only the owned keys that fail to parse as JSON, leaving every
 * healthy key (including playlists/watch history) untouched. Returns the
 * list of keys that were actually reset, for the UI to report back.
 */
export function repairCorruptedSettings(): string[] {
  const repaired: string[] = [];
  for (const key of OWNED_KEYS) {
    if (isCorrupted(key)) {
      localStorage.removeItem(key);
      repaired.push(key);
    }
  }
  return repaired;
}

/**
 * Resets only the UI-facing fields inside `aurex-settings` (theme, accent,
 * dynamic accent, always-on-top) - shortcuts, skip interval, onboarding
 * state, and the last-opened folder are left alone, since those aren't "UI
 * configuration". Window position/size lives in a separate Rust-side file
 * (see `reset_window_state` in repair.rs) and is reset alongside this by the
 * caller.
 */
export function resetUiConfiguration() {
  const raw = localStorage.getItem("aurex-settings");
  let parsed: Record<string, unknown> = {};
  try {
    if (raw) parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  const next = {
    ...parsed,
    theme: "dark",
    accent: "blue",
    dynamicAccentEnabled: false,
    alwaysOnTop: false,
  };
  localStorage.setItem("aurex-settings", JSON.stringify(next));
}

/**
 * Full reset of general settings and the equalizer to their defaults.
 * Deliberately never touches "aurex-watch-history" (Continue Watching) or
 * the in-memory playlist - matching the same exclusion Cache Manager already
 * honors elsewhere in the app.
 */
export function restoreDefaultSettings() {
  localStorage.removeItem("aurex-settings");
  localStorage.removeItem("aurex-equalizer");
}
