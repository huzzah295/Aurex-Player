const STORAGE_KEY = "aurex-watch-history";
const MAX_ENTRIES = 300;

// Don't offer to resume a file that's barely been started (indistinguishable
// from just having opened it) or one that's basically finished (the credits/
// last few seconds - resuming there is pointless, may as well restart).
const MIN_RESUME_SECONDS = 10;
const END_GUARD_SECONDS = 15;

interface WatchEntry {
  positionSeconds: number;
  updatedAt: number;
}

type WatchHistory = Record<string, WatchEntry>;

function load(): WatchHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore corrupt storage
  }
  return {};
}

function persist(history: WatchHistory) {
  const entries = Object.entries(history);
  if (entries.length <= MAX_ENTRIES) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    return;
  }
  // Prune oldest entries rather than growing unbounded across a long
  // history of watched files.
  entries.sort(([, a], [, b]) => b.updatedAt - a.updatedAt);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries.slice(0, MAX_ENTRIES))));
}

/** Returns a saved position for this file, or null if there's none worth offering to resume. */
export function getSavedProgress(path: string): number | null {
  const entry = load()[path];
  if (!entry || entry.positionSeconds < MIN_RESUME_SECONDS) return null;
  return entry.positionSeconds;
}

/**
 * Records how far into `path` playback has reached. Called periodically
 * during playback (throttled - see playbackService) rather than only on
 * close, since there's no reliable "about to quit" hook for a native window
 * close/crash to persist a single final position instead.
 */
export function saveProgress(path: string, positionSeconds: number, durationSeconds: number) {
  if (!path || !Number.isFinite(positionSeconds)) return;
  const history = load();
  // Near the end - clear instead of saving, so a finished file doesn't
  // prompt "continue from 1:59:58" the next time it's opened.
  if (durationSeconds > 0 && positionSeconds >= durationSeconds - END_GUARD_SECONDS) {
    if (history[path]) {
      delete history[path];
      persist(history);
    }
    return;
  }
  history[path] = { positionSeconds, updatedAt: Date.now() };
  persist(history);
}

export function clearProgress(path: string) {
  const history = load();
  if (!history[path]) return;
  delete history[path];
  persist(history);
}
