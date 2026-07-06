import { useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { useUpdateStore, type UpdateInfo } from "../stores/updateStore";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Silently checks for an update once, shortly after launch, so users don't
 * have to remember to open Settings > Updates themselves. Reuses the same
 * `check_for_update` command (and its 15-minute cache on the Rust side) the
 * manual "Check for Updates" button already calls - this is just an
 * additional, quiet trigger for it, not a second code path. Failures are
 * swallowed: a background check has no one to report an error to, and the
 * manual button in Settings remains available if this one doesn't land.
 */
export function useAutoUpdateCheck() {
  useEffect(() => {
    if (!isTauri) return;
    if (!useSettingsStore.getState().autoCheckForUpdates) return;

    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<UpdateInfo>("check_for_update");
        useUpdateStore.getState().setInfo(result);
      } catch {
        // No one to report a background failure to - the manual button
        // in Settings > Updates still works if the user checks themselves.
      }
    })();
  }, []);
}
