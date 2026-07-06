export type ShortcutAction =
  | "playPause"
  | "seekBackward"
  | "seekForward"
  | "volumeUp"
  | "volumeDown"
  | "toggleMute"
  | "toggleFullscreen"
  | "nextTrack"
  | "previousTrack"
  | "cycleRepeat"
  | "toggleShuffle";

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  playPause: "Play / Pause",
  seekBackward: "Seek Backward",
  seekForward: "Seek Forward",
  volumeUp: "Volume Up",
  volumeDown: "Volume Down",
  toggleMute: "Mute",
  toggleFullscreen: "Fullscreen",
  nextTrack: "Next Track",
  previousTrack: "Previous Track",
  cycleRepeat: "Cycle Repeat Mode",
  toggleShuffle: "Shuffle",
};

export const SHORTCUT_ACTIONS = Object.keys(SHORTCUT_LABELS) as ShortcutAction[];

export const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  playPause: "Space",
  seekBackward: "ArrowLeft",
  seekForward: "ArrowRight",
  volumeUp: "ArrowUp",
  volumeDown: "ArrowDown",
  toggleMute: "KeyM",
  toggleFullscreen: "KeyF",
  nextTrack: "Ctrl+ArrowRight",
  previousTrack: "Ctrl+ArrowLeft",
  cycleRepeat: "KeyR",
  toggleShuffle: "KeyS",
};

const CODE_LABELS: Record<string, string> = {
  Space: "Space",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
};

/** Renders a stored combo (e.g. "Ctrl+ArrowRight") as a readable label. */
export function formatShortcut(combo: string): string {
  return combo
    .split("+")
    .map((part) => {
      if (CODE_LABELS[part]) return CODE_LABELS[part];
      if (part.startsWith("Key")) return part.slice(3);
      if (part.startsWith("Digit")) return part.slice(5);
      return part;
    })
    .join(" + ");
}

/** Encodes a keydown event as a layout-independent combo string. */
export function comboFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  parts.push(e.code);
  return parts.join("+");
}

/** Keys that should never be usable as a shortcut on their own (modifiers). */
export const MODIFIER_ONLY_CODES = new Set([
  "ControlLeft", "ControlRight", "AltLeft", "AltRight",
  "ShiftLeft", "ShiftRight", "MetaLeft", "MetaRight",
]);
