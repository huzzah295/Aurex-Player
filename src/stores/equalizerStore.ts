import { create } from "zustand";
import { BUILTIN_EQ_PRESETS, EQ_BAND_COUNT } from "../lib/equalizerPresets";

const STORAGE_KEY = "aurex-equalizer";
const FLAT_BANDS = Array<number>(EQ_BAND_COUNT).fill(0);

interface Persisted {
  enabled: boolean;
  bands: number[];
  activePresetName: string | null;
  customPresets: Record<string, number[]>;
}

interface EqualizerStore extends Persisted {
  setEnabled: (enabled: boolean) => void;
  setBand: (index: number, value: number) => void;
  applyPreset: (name: string) => void;
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (name: string) => void;
}

function isValidBands(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === EQ_BAND_COUNT && value.every((n) => typeof n === "number");
}

function loadInitial(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidBands(parsed.bands)) {
        return {
          enabled: Boolean(parsed.enabled),
          bands: parsed.bands,
          activePresetName: typeof parsed.activePresetName === "string" ? parsed.activePresetName : null,
          customPresets:
            parsed.customPresets && typeof parsed.customPresets === "object" ? parsed.customPresets : {},
        };
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return { enabled: false, bands: [...FLAT_BANDS], activePresetName: "Flat", customPresets: {} };
}

function persist(state: Persisted) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bandsForPreset(name: string, customPresets: Record<string, number[]>): number[] | null {
  return BUILTIN_EQ_PRESETS.find((p) => p.name === name)?.bands ?? customPresets[name] ?? null;
}

const initial = loadInitial();

export const useEqualizerStore = create<EqualizerStore>((set, get) => ({
  ...initial,

  setEnabled: (enabled) => {
    set({ enabled });
    persist({ ...get(), enabled });
  },

  setBand: (index, value) => {
    const bands = [...get().bands];
    bands[index] = value;
    set({ bands, activePresetName: null });
    persist({ ...get(), bands, activePresetName: null });
  },

  applyPreset: (name) => {
    const bands = bandsForPreset(name, get().customPresets);
    if (!bands) return;
    const nextBands = [...bands];
    set({ bands: nextBands, activePresetName: name });
    persist({ ...get(), bands: nextBands, activePresetName: name });
  },

  saveCustomPreset: (name) => {
    const customPresets = { ...get().customPresets, [name]: [...get().bands] };
    set({ customPresets, activePresetName: name });
    persist({ ...get(), customPresets, activePresetName: name });
  },

  deleteCustomPreset: (name) => {
    const customPresets = { ...get().customPresets };
    delete customPresets[name];
    const activePresetName = get().activePresetName === name ? null : get().activePresetName;
    set({ customPresets, activePresetName });
    persist({ ...get(), customPresets, activePresetName });
  },
}));
