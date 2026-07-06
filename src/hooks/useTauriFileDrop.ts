import { useEffect } from "react";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Listens for native OS drag-and-drop of files onto the window. Browser drag
 * events don't expose real filesystem paths, so we use Tauri's webview-level
 * drag-drop event instead, which does.
 */
export function useTauriFileDrop(onFiles: (paths: string[]) => void) {
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;

    (async () => {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          onFiles(event.payload.paths);
        }
      });
    })();

    return () => unlisten?.();
  }, [onFiles]);
}
