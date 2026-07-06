// A click that closes an open overlay (e.g. the app menu, via clicking
// outside it) fires as a `mousedown` first, then a trailing `click` on
// whatever was underneath - which for the audio-only video surface would
// otherwise be interpreted as "toggle play/pause". By the time that `click`
// fires, the overlay's own state is already updated (closed), so checking
// "is the menu open right now" inside the click handler can't tell the two
// cases apart. This one-shot flag lets the code that closes an overlay mark
// the very next surface click as consumed instead.
let suppressed = false;

export function suppressNextSurfaceClick() {
  suppressed = true;
}

export function consumeSurfaceClickSuppression(): boolean {
  if (!suppressed) return false;
  suppressed = false;
  return true;
}
