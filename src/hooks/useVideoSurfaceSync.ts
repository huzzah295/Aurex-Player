import { useEffect, useRef } from "react";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Keeps the native mpv child window (embedded via --wid) aligned with this
 * element's on-screen bounds. mpv renders outside the webview's control, so
 * its window must be manually resized/repositioned whenever this area does.
 *
 * The native window sits above the webview in z-order (otherwise the video
 * would never be visible), which means it also intercepts clicks and drops
 * over that same screen area. While `active` is false (no media loaded), it
 * is collapsed to zero size so the "Open File" prompt underneath stays
 * clickable and drag-and-drop reaches the webview instead of mpv.
 */
export function useVideoSurfaceSync<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !isTauri) return;

    let invoke: typeof import("@tauri-apps/api/core").invoke;
    let cancelled = false;

    import("@tauri-apps/api/core").then((mod) => {
      if (cancelled) return;
      invoke = mod.invoke;
      sync();
    });

    const sync = () => {
      if (!invoke) return;
      if (!active) {
        void invoke("mpv_resize_surface", { x: 0, y: 0, width: 0, height: 0 });
        return;
      }
      const rect = el.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      void invoke("mpv_resize_surface", {
        x: Math.round(rect.left * scale),
        y: Math.round(rect.top * scale),
        width: Math.round(rect.width * scale),
        height: Math.round(rect.height * scale),
      });
    };

    const observer = new ResizeObserver(sync);
    observer.observe(el);
    window.addEventListener("resize", sync);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [active]);

  return ref;
}
