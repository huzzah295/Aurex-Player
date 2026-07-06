import { useEffect } from "react";
import { useUiStore } from "../stores/uiStore";
import { usePlayerStore } from "../stores/playerStore";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// The settings dialog's own entrance animation (scale/translate, ~180ms - see
// SettingsDialog.tsx) briefly changes its rendered bounding box; one extra
// measurement after it settles keeps the exclusion hole from staying a few
// pixels off for the rest of the time the dialog is open.
const SETTLE_REMEASURE_MS = 200;

/**
 * Carves the app menu dropdown's / settings dialog panel's on-screen area out
 * of the native video window's paintable+hit-testable region instead of
 * hiding or zero-sizing the whole window (see VideoSurface's surfaceActive
 * comment for why the old approach broke playback). `SetWindowRgn` on the
 * Rust side clips both painting and mouse hit-testing, so the excluded area
 * both shows the webview underneath and lets clicks reach it - everywhere
 * else the video keeps rendering, playing and receiving clicks exactly as
 * normal.
 *
 * Only the actual dialog panel (or menu dropdown, or resume-playback prompt)
 * is excluded, not the whole surface - excluding the whole surface (as this
 * used to do for the settings dialog, reasoning its backdrop "covers" it
 * anyway) makes mpv paint nothing there at all, so instead of a dimmed video
 * the user sees the plain black app background behind the backdrop. The
 * panel is measured directly via a `data-overlay`/`role` attribute rather
 * than threading a ref cross-tree from a sibling component; a few pixels of
 * imprecision during its open/close animation is harmless. The video is
 * separately dimmed (via a compositor-level alpha blend on the native
 * surface, not by touching mpv's decoder/renderer) while the settings dialog
 * is open, so it reads as "underneath a modal" instead of full brightness -
 * the backdrop's own dark tint is what shows through the blend. The menu
 * dropdown and resume prompt are small enough that dimming the whole video
 * behind them isn't worthwhile.
 */
export function useVideoSurfaceOverlayExclusion(containerRef: React.RefObject<HTMLElement | null>) {
  const menuOpen = useUiStore((s) => s.menuOpen);
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const hasResumePrompt = usePlayerStore((s) => s.resumePrompt !== null);

  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;

    const applyExclusion = async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      if (cancelled) return;

      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const width = Math.round(containerRect.width * scale);
      const height = Math.round(containerRect.height * scale);

      let excludeRect: DOMRect | null = null;
      if (settingsOpen) {
        excludeRect = document.querySelector('[role="dialog"]')?.getBoundingClientRect() ?? null;
      } else if (menuOpen) {
        excludeRect = document.querySelector('[role="menu"]')?.getBoundingClientRect() ?? null;
      } else if (hasResumePrompt) {
        excludeRect = document.querySelector('[data-overlay="resume-prompt"]')?.getBoundingClientRect() ?? null;
      }

      void invoke("mpv_set_surface_exclusion", {
        width,
        height,
        excludeX: excludeRect ? Math.round((excludeRect.left - containerRect.left) * scale) : 0,
        excludeY: excludeRect ? Math.round((excludeRect.top - containerRect.top) * scale) : 0,
        excludeWidth: excludeRect ? Math.round(excludeRect.width * scale) : 0,
        excludeHeight: excludeRect ? Math.round(excludeRect.height * scale) : 0,
      });
    };

    void applyExclusion();
    // The resume prompt plays the same entrance animation as the settings
    // dialog (a brief scale/translate) - remeasure once it settles for the
    // same reason.
    const settleTimer =
      settingsOpen || hasResumePrompt ? window.setTimeout(() => void applyExclusion(), SETTLE_REMEASURE_MS) : null;
    window.addEventListener("resize", applyExclusion);

    return () => {
      cancelled = true;
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      window.removeEventListener("resize", applyExclusion);
    };
  }, [menuOpen, settingsOpen, hasResumePrompt, containerRef]);

  useEffect(() => {
    if (!isTauri) return;
    let cancelled = false;
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      if (cancelled) return;
      void invoke("mpv_set_surface_dim", { dimmed: settingsOpen });
    })();
    return () => {
      cancelled = true;
    };
  }, [settingsOpen]);
}
