// Standard ISO 10-band graphic equalizer center frequencies (Hz). Order here
// must match `EQ_BANDS` in src-tauri/src/commands.rs - band gains are sent
// to mpv as a plain array, positionally matched to these frequencies.
export const EQ_FREQUENCIES = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export const EQ_BAND_COUNT = EQ_FREQUENCIES.length;

export function formatEqFrequency(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}kHz` : `${hz}Hz`;
}

export interface EqualizerPreset {
  name: string;
  bands: number[];
}

// Hand-tuned gain curves (dB) for each of the 10 ISO bands above.
export const BUILTIN_EQ_PRESETS: EqualizerPreset[] = [
  { name: "Flat", bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Cinema", bands: [4, 3, 2, 0, -1, 0, 1, 2, 3, 3] },
  { name: "Music", bands: [3, 2, 1, 0, -1, -1, 0, 1, 2, 3] },
  { name: "Podcast", bands: [-2, -2, 0, 2, 4, 4, 3, 1, -1, -2] },
  { name: "Rock", bands: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5] },
  { name: "Pop", bands: [-1, 0, 2, 4, 4, 2, 0, -1, -1, -2] },
  { name: "Bass Boost", bands: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0] },
  { name: "Treble Boost", bands: [0, 0, 0, 0, 0, 1, 3, 5, 6, 7] },
  { name: "Vocal Boost", bands: [-2, -2, -1, 1, 4, 4, 3, 1, -1, -2] },
];
