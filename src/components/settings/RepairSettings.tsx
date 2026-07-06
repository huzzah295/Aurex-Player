import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { repairCorruptedSettings, resetUiConfiguration, restoreDefaultSettings } from "../../lib/repair";

const list: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const row: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type ActionKey = "cache" | "corrupted" | "ui" | "engine" | "defaults";
type Status = { action: ActionKey; message: string; tone: "success" | "error" } | null;

const CONFIRM_COPY: Record<ActionKey, string> = {
  cache: "This clears Aurex Player's WebView render/network cache. Your playlists, favorites, resume history, themes, and keyboard shortcuts are never touched.",
  corrupted: "This scans your saved settings, volume, equalizer, and watch history for corrupted data and resets only what's actually broken.",
  ui: "This resets theme, accent color, always-on-top, and window position/size to their defaults. Shortcuts, equalizer, and playback preferences are left alone. Requires a restart to fully apply.",
  engine: "This restarts Aurex Player to give the playback engine a completely fresh start. Current playback will stop.",
  defaults: "This resets general settings and the equalizer to their defaults. Your playlists and watch history are never touched. Requires a restart to fully apply.",
};

export function RepairSettings() {
  const [status, setStatus] = useState<Status>(null);
  const [showRestartPrompt, setShowRestartPrompt] = useState(false);
  const [busy, setBusy] = useState<ActionKey | null>(null);

  const runConfirmed = async (action: ActionKey, body: () => Promise<string>, needsRestart: boolean) => {
    if (!isTauri) return;
    const { confirm } = await import("@tauri-apps/plugin-dialog");
    const confirmed = await confirm(CONFIRM_COPY[action], { title: "Repair Mode", kind: "warning" });
    if (!confirmed) return;

    setBusy(action);
    setShowRestartPrompt(false);
    try {
      const message = await body();
      setStatus({ action, message, tone: "success" });
      if (needsRestart) setShowRestartPrompt(true);
    } catch (err) {
      setStatus({ action, message: String(err), tone: "error" });
    } finally {
      setBusy(null);
    }
  };

  const handleRebuildCache = () =>
    runConfirmed(
      "cache",
      async () => {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("clear_playback_cache");
        return "Playback cache cleared.";
      },
      true,
    );

  const handleResetCorrupted = () =>
    runConfirmed(
      "corrupted",
      async () => {
        const repaired = repairCorruptedSettings();
        return repaired.length === 0
          ? "No corrupted settings were found."
          : `Reset corrupted data in: ${repaired.join(", ")}.`;
      },
      false,
    );

  const handleResetUi = () =>
    runConfirmed(
      "ui",
      async () => {
        resetUiConfiguration();
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("reset_window_state");
        return "UI configuration reset to defaults.";
      },
      true,
    );

  const handleResetEngine = () =>
    runConfirmed(
      "engine",
      async () => {
        const { relaunch } = await import("@tauri-apps/plugin-process");
        await relaunch();
        return "Restarting...";
      },
      false,
    );

  const handleRestoreDefaults = () =>
    runConfirmed(
      "defaults",
      async () => {
        restoreDefaultSettings();
        return "Default settings restored.";
      },
      true,
    );

  const handleRestart = async () => {
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <h2 className="text-base font-semibold">Repair</h2>
      <p className="text-sm text-[rgb(var(--text-muted))]">
        If Aurex Player is misbehaving, these tools reset specific parts of it without touching your
        playlists or watch history.
      </p>

      <motion.div variants={list} initial="hidden" animate="visible" className="flex flex-col gap-2">
        <RepairRow
          label="Rebuild Playback Cache"
          description="Clears the WebView render/network cache."
          onClick={() => void handleRebuildCache()}
          disabled={busy !== null}
        />
        <RepairRow
          label="Reset Only Corrupted Settings"
          description="Scans and resets only settings that fail to load correctly."
          onClick={() => void handleResetCorrupted()}
          disabled={busy !== null}
        />
        <RepairRow
          label="Reset UI Configuration"
          description="Theme, accent color, always-on-top, and window position/size."
          onClick={() => void handleResetUi()}
          disabled={busy !== null}
        />
        <RepairRow
          label="Reset Playback Engine"
          description="Restarts Aurex Player for a completely fresh playback session."
          onClick={() => void handleResetEngine()}
          disabled={busy !== null}
        />
        <RepairRow
          label="Restore Default Settings"
          description="Resets general settings and the equalizer. Never touches playlists or watch history."
          onClick={() => void handleRestoreDefaults()}
          disabled={busy !== null}
          accent
        />
      </motion.div>

      <AnimatePresence mode="wait">
        {status && (
          <motion.p
            key={status.message}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`text-sm ${status.tone === "success" ? "text-[rgb(var(--success))]" : "text-[rgb(var(--danger))]"}`}
          >
            {status.message}
          </motion.p>
        )}
      </AnimatePresence>

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
              Restarting Aurex Player ensures everything picks up the reset cleanly.
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

function RepairRow({
  label,
  description,
  onClick,
  disabled,
  accent,
}: {
  label: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
  accent?: boolean;
}) {
  return (
    <motion.div
      variants={row}
      className="glass-panel flex items-center justify-between gap-3 rounded-md border border-[rgb(var(--border))] px-3.5 py-2.5 shadow-sm"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm text-[rgb(var(--text))]">{label}</span>
        <span className="text-xs text-[rgb(var(--text-muted))]">{description}</span>
      </div>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`glass-btn shrink-0 rounded-md border px-3.5 py-2 text-sm font-medium transition-colors duration-150 disabled:cursor-default disabled:opacity-50 ${
          accent
            ? "border-[rgb(var(--accent))] text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent))] hover:text-white"
            : "border-[rgb(var(--border))] text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-hover))]"
        }`}
      >
        Run
      </button>
    </motion.div>
  );
}
