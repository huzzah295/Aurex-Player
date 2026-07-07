import { useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useSettingsStore } from "../../stores/settingsStore";
import { useUpdateStore, type UpdateInfo } from "../../stores/updateStore";
import { ToggleField } from "../ui/Toggle";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const grid: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const gridItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
};

type Status = "idle" | "checking" | "upToDate" | "available" | "downloading" | "error" | "downloadError";

/** Turns a shared store result (from a background check, or none yet) into this panel's initial status. */
function statusFromStoredInfo(info: UpdateInfo | null): Status {
  if (!info) return "idle";
  return info.upToDate ? "upToDate" : "available";
}

export function UpdateSettings() {
  // Seeded from the shared store so a background check's result (see
  // useAutoUpdateCheck) is already on screen the moment this tab opens,
  // instead of showing "idle" until the user clicks Check for Updates again.
  const [status, setStatus] = useState<Status>(() => statusFromStoredInfo(useUpdateStore.getState().info));
  const [info, setInfo] = useState(() => useUpdateStore.getState().info);
  const [errorMessage, setErrorMessage] = useState("");
  const autoCheckForUpdates = useSettingsStore((s) => s.autoCheckForUpdates);
  const setAutoCheckForUpdates = useSettingsStore((s) => s.setAutoCheckForUpdates);

  const handleCheck = async () => {
    if (!isTauri) return;
    setStatus("checking");
    setErrorMessage("");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<UpdateInfo>("check_for_update");
      setInfo(result);
      useUpdateStore.getState().setInfo(result);
      setStatus(result.upToDate ? "upToDate" : "available");
    } catch (err) {
      setErrorMessage(String(err));
      setStatus("error");
    }
  };

  const handleDownloadAndInstall = async () => {
    if (!isTauri || !info?.downloadUrl) return;
    setStatus("downloading");
    setErrorMessage("");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("download_and_install_update", { downloadUrl: info.downloadUrl });
      const { exit } = await import("@tauri-apps/plugin-process");
      await exit(0);
    } catch (err) {
      setErrorMessage(String(err));
      setStatus("downloadError");
    }
  };

  return (
    <div className="flex flex-col gap-5 p-6">
      <h2 className="text-base font-semibold">Updates</h2>

      <motion.div variants={grid} initial="hidden" animate="visible" className="grid grid-cols-2 gap-3">
        <VersionRow label="Current Version" value={info?.currentVersion ?? "—"} />
        <VersionRow label="Latest Version" value={info?.latestVersion ?? "—"} />
      </motion.div>

      <ToggleField
        label="Automatically check for updates on launch"
        checked={autoCheckForUpdates}
        onChange={setAutoCheckForUpdates}
      />

      <div className="flex flex-col gap-2">
        <button
          onClick={() => void handleCheck()}
          disabled={status === "checking" || status === "downloading"}
          className="glass-btn w-fit rounded-md border border-[rgb(var(--border))] px-3.5 py-2 text-sm font-medium text-[rgb(var(--text))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] disabled:cursor-default disabled:opacity-50"
        >
          {status === "checking" ? "Checking..." : "Check for Updates"}
        </button>

        <AnimatePresence mode="wait">
          {status === "upToDate" && (
            <motion.p
              key="up-to-date"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="text-sm text-[rgb(var(--success))]"
            >
              You are using the latest version of Aurex Player.
            </motion.p>
          )}

          {status === "available" && info && (
            <motion.div
              key="available"
              initial={{ opacity: 0, scale: 0.97, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="glass-panel flex flex-col gap-2 rounded-md border border-[rgb(var(--border))] p-3 shadow-sm"
            >
              <p className="text-sm text-[rgb(var(--text))]">
                Version {info.latestVersion} is available (you have {info.currentVersion}).
              </p>
              {info.downloadUrl ? (
                <button
                  onClick={() => void handleDownloadAndInstall()}
                  disabled={status !== "available"}
                  className="glass-btn w-fit rounded-md bg-[rgb(var(--accent))] px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  Download and Install
                </button>
              ) : (
                <p className="text-sm text-[rgb(var(--text-muted))]">
                  No installer asset was found on the latest release.
                </p>
              )}
            </motion.div>
          )}

          {status === "downloading" && (
            <motion.p
              key="downloading"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="text-sm text-[rgb(var(--text-muted))]"
            >
              Downloading update - Aurex Player will close and the installer will open shortly...
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
              Couldn't check for updates: {errorMessage}
            </motion.p>
          )}

          {status === "downloadError" && (
            <motion.div
              key="download-error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-2"
            >
              <p className="text-sm text-[rgb(var(--danger))]">{errorMessage}</p>
              <button
                onClick={() => void handleDownloadAndInstall()}
                className="glass-btn w-fit rounded-md bg-[rgb(var(--accent))] px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
              >
                Retry Download
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function VersionRow({ label, value }: { label: string; value: string }) {
  return (
    <motion.div
      variants={gridItem}
      className="glass-panel flex flex-col gap-0.5 rounded-md border border-[rgb(var(--border))] px-3 py-2 shadow-sm"
    >
      <span className="text-xs text-[rgb(var(--text-muted))]">{label}</span>
      <span className="tabular-nums text-sm text-[rgb(var(--text))]">{value}</span>
    </motion.div>
  );
}
