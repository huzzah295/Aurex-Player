import { useEffect } from "react";
import { openPaths } from "../lib/openMedia";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Handles a media file opened via Windows (double-click on an associated
 * file, or "Open With" > Aurex Player). Two paths feed into this:
 *  - Cold start: the file is passed as a CLI argument, captured Rust-side
 *    before the webview exists, so we pull it once via a command instead of
 *    listening for an event we'd have missed.
 *  - Already running: a second launch attempt is caught by the
 *    single-instance plugin, which forwards the path to this (already
 *    mounted) instance as a live event.
 */
export function useOpenFileFromOS() {
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;

    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<string>("open-file", (event) => {
        openPaths([event.payload]);
      });

      const { invoke } = await import("@tauri-apps/api/core");
      const pending = await invoke<string | null>("take_pending_open_path");
      if (pending) openPaths([pending]);
    })();

    return () => unlisten?.();
  }, []);
}
