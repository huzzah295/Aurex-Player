import { create } from "zustand";

export type VideoEqProperty = "brightness" | "contrast" | "saturation" | "gamma" | "hue";

type VideoEqValues = Record<VideoEqProperty, number>;

const DEFAULTS: VideoEqValues = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  gamma: 0,
  hue: 0,
};

interface VideoEqStore extends VideoEqValues {
  setValue: (property: VideoEqProperty, value: number) => void;
  reset: () => void;
}

export const useVideoEqStore = create<VideoEqStore>((set) => ({
  ...DEFAULTS,
  setValue: (property, value) => set({ [property]: value }),
  reset: () => set({ ...DEFAULTS }),
}));
