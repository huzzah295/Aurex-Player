import { usePlayerStore } from "../stores/playerStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { MediaTrack } from "../types/player";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "flac", "aac", "ogg", "opus", "m4a"]);
const VIDEO_EXTENSIONS = ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "mpeg", "mpg", "ts", "m4v"];
const MEDIA_EXTENSIONS = [...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS];

export function toTrack(path: string): MediaTrack {
  const name = path.split(/[\\/]/).pop() ?? path;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return { id: path, path, title: name, durationSeconds: 0, isVideo: !AUDIO_EXTENSIONS.has(ext) };
}

function folderOf(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx > 0 ? path.slice(0, idx) : path;
}

export function openPaths(paths: string[]) {
  if (!paths.length) return;
  usePlayerStore.getState().setPlaylist(paths.map(toTrack), 0);
}

export async function openFilesDialog() {
  if (!isTauri) return;
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: true,
      defaultPath: useSettingsStore.getState().lastOpenedFolder ?? undefined,
      filters: [{ name: "Media", extensions: MEDIA_EXTENSIONS }],
    });
    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];
    useSettingsStore.getState().setLastOpenedFolder(folderOf(paths[0]));
    openPaths(paths);
  } catch (err) {
    console.error("[openMedia] failed to open file dialog:", err);
    usePlayerStore.getState().setError(String(err));
  }
}

export async function openFolderDialog() {
  if (!isTauri) return;
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const folder = await open({
      directory: true,
      defaultPath: useSettingsStore.getState().lastOpenedFolder ?? undefined,
    });
    if (!folder) return;
    useSettingsStore.getState().setLastOpenedFolder(folder);
    const { invoke } = await import("@tauri-apps/api/core");
    const paths = await invoke<string[]>("list_media_files", { folder });
    if (!paths.length) {
      usePlayerStore.getState().setError("No supported media files found in that folder.");
      return;
    }
    openPaths(paths);
  } catch (err) {
    console.error("[openMedia] failed to open folder:", err);
    usePlayerStore.getState().setError(String(err));
  }
}
