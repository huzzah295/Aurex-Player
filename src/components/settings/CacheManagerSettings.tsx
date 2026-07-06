import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { formatBytes } from "../../lib/format";

const grid: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const gridItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

type ClearTarget = "playback" | "temp" | "all";
type Status = "idle" | "clearing" | "success" | "error";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

interface CacheSizes {
  playbackBytes: number;
  tempBytes: number;
  totalBytes: number;
}

const CLEAR_COMMANDS: Record<ClearTarget, string> = {
  playback: "clear_playback_cache",
  temp: "clear_temp_files",
  all: "clear_all_cache",
};

const CONFIRM_COPY: Record<ClearTarget, string> = {
  playback: "This clears Aurex Player's WebView render/network cache. Your playlists, favorites, resume history, themes, and keyboard shortcuts are never touched.",
  temp: "This clears Aurex Player's temporary files.",
  all: "This clears all of Aurex Player's caches (playback and temporary files). Your playlists, favorites, resume history, themes, and keyboard shortcuts are never touched.",
};

// Clearing the playback cache touches WebView2's own on-disk cache while the
// WebView is actively running off of it - a restart ensures everything picks
// that up cleanly. A temp-files clear doesn't affect the running WebView at
// all, so no restart is suggested for that one.
const RESTART_TARGETS = new Set<ClearTarget>(["playback", "all"]);

export function CacheManagerSettings() {
  const [sizes, setSizes] = useState<CacheSizes | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);

  const refreshSizes = async () => {
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<CacheSizes>("get_cache_sizes");
      setSizes(result);
    } catch {
      // Leave sizes as-is; the buttons below still work independently.
    }
  };

  useEffect(() => {
    void refreshSizes();
  }, []);

  const handleClear = async (target: ClearTarget) => {
    if (!isTauri) return;
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    const confirmed = await confirm(CONFIRM_COPY[target], { title: "Clear Cache", kind: "warning" });
    if (!confirmed) return;

    setStatus("clearing");
    setShowRestartPrompt(false);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke(CLEAR_COMMANDS[target]);
      await refreshSizes();
      setStatus("success");
      if (RESTART_TARGETS.has(target)) setShowRestartPrompt(true);
    } catch {
      setStatus("error");
    }
  };

  const handleRestart = async () => {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <h2 className="text-base font-semibold">Cache</h2>

      <motion.div variants={grid} initial="hidden" animate="visible" className="grid grid-cols-3 gap-3">
        <CacheRow label="Playback Cache" value={sizes ? formatBytes(sizes.playbackBytes) : "—"} />
        <CacheRow label="Temporary Files" value={sizes ? formatBytes(sizes.tempBytes) : "—"} />
        <CacheRow label="Total Usage" value={sizes ? formatBytes(sizes.totalBytes) : "—"} emphasize />
      </motion.div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <ClearButton label="Clear Playback Cache" onClick={() => void handleClear("playback")} disabled={status === "clearing"} />
          <ClearButton label="Clear Temporary Files" onClick={() => void handleClear("temp")} disabled={status === "clearing"} />
          <ClearButton label="Clear All Cache" onClick={() => void handleClear("all")} disabled={status === "clearing"} accent />
        </div>
        <AnimatePresence mode="wait">
          {status === "success" && (
            <motion.p
              key="success"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="text-sm text-[rgb(var(--success))]"
            >
              Cache cleared successfully.
            </motion.p>
          )}
          {status === "error" && (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="text-sm text-[rgb(var(--danger))]"
            >
              Something went wrong clearing the cache. Please try again.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showRestartPrompt && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="glass-panel flex flex-col gap-2 rounded-md border border-[rgb(var(--border))] p-3 shadow-sm"
          >
            <p className="text-sm text-[rgb(var(--text))]">
              Restarting Aurex Player ensures everything picks up the cleared cache cleanly.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => void handleRestart()}
                className="glass-btn rounded-md bg-[rgb(var(--accent))] px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Restart Now
              </button>
              <button
                onClick={() => setShowRestartPrompt(false)}
                className="glass-btn rounded-md px-3.5 py-2 text-sm text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
              >
                Later
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CacheRow({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <motion.div
      variants={gridItem}
      className="glass-panel flex flex-col gap-0.5 rounded-md border border-[rgb(var(--border))] px-3 py-2 shadow-sm"
    >
      <span className="text-xs text-[rgb(var(--text-muted))]">{label}</span>
      <span className={`tabular-nums ${emphasize ? "text-base font-semibold" : "text-sm"} text-[rgb(var(--text))]`}>{value}</span>
    </motion.div>
  );
}

function ClearButton({
  label,
  onClick,
  disabled,
  accent,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`glass-btn rounded-md border px-3.5 py-2 text-sm font-medium transition-colors duration-150 disabled:cursor-default disabled:opacity-50 ${
        accent
          ? "border-[rgb(var(--accent))] text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))] hover:text-white"
          : "border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-hover))]"
      }`}
    >
      {label}
    </button>
  );
}
