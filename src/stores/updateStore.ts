import { create } from "zustand";

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  upToDate: boolean;
  downloadUrl: string | null;
  releaseUrl: string;
}

interface UpdateStore {
  /** Result of the most recent check (manual or automatic) - null until the first check resolves. */
  info: UpdateInfo | null;
  setInfo: (info: UpdateInfo | null) => void;
}

/**
 * Shared between the silent startup check (useAutoUpdateCheck) and the
 * Settings > Updates panel, so a background check's result is already on
 * screen the moment a user opens that tab, and the menu badge (AppMenu)
 * reflects the same result without either component polling separately.
 */
export const useUpdateStore = create<UpdateStore>((set) => ({
  info: null,
  setInfo: (info) => set({ info }),
}));
