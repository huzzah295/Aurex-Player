const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Resets the fullscreen control bar's 3-second auto-hide countdown and shows
 * it if it had already faded out. Shared by every trigger point (mouse
 * movement, keyboard shortcuts, clicks, wheel-scrolling) so they all agree on
 * "something happened" instead of re-implementing the same invoke.
 */
export async function pulseFullscreenControls() {
  if (!isTauri) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("pulse_fullscreen_controls");
}

/**
 * Suspends (or resumes) the auto-hide countdown entirely - for interactions
 * that must keep the bar on-screen regardless of how long the mouse stays
 * still: hovering the bar itself, or the video-adjust popover being open.
 */
export async function setFullscreenControlsSuspended(suspended: boolean) {
  if (!isTauri) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("set_fullscreen_controls_suspended", { suspended });
}
