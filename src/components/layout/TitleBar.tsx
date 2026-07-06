import { useEffect, useState } from "react";
import { CloseIcon, MaximizeIcon, MinimizeIcon, RestoreIcon } from "../icons";
import { AppMenu } from "./AppMenu";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getAppWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

interface TitleBarProps {
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenEqualizer: () => void;
  onOpenAbout: () => void;
  onOpenUpdates: () => void;
}

export function TitleBar({ onOpenSettings, onOpenShortcuts, onOpenEqualizer, onOpenAbout, onOpenUpdates }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const win = await getAppWindow();
      const initial = await win.isMaximized();
      if (cancelled) return;
      setMaximized(initial);
      unlisten = await win.onResized(async () => {
        setMaximized(await win.isMaximized());
      });
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const handleMinimize = () => isTauri && getAppWindow().then((w) => w.minimize());
  const handleMaximize = () => isTauri && getAppWindow().then((w) => w.toggleMaximize());
  const handleClose = () => isTauri && getAppWindow().then((w) => w.close());

  return (
    <div
      data-tauri-drag-region
      className="glass-panel flex h-9 shrink-0 items-center justify-between border-b border-[rgb(var(--border))] text-[13px] select-none"
    >
      <div className="flex items-center">
        <AppMenu
          onOpenSettings={onOpenSettings}
          onOpenShortcuts={onOpenShortcuts}
          onOpenEqualizer={onOpenEqualizer}
          onOpenAbout={onOpenAbout}
          onOpenUpdates={onOpenUpdates}
        />
        <div data-tauri-drag-region className="flex h-9 flex-1 items-center gap-2 pl-1 pr-3 text-[rgb(var(--text-muted))]">
          <span className="h-2 w-2 rounded-full bg-[rgb(var(--accent))]" />
          <span data-tauri-drag-region className="font-medium tracking-wide text-[rgb(var(--text))]">
            Aurex Player
          </span>
        </div>
      </div>
      <div data-tauri-drag-region className="h-9 flex-1" />
      <div className="flex h-full">
        <button
          onClick={handleMinimize}
          className="flex h-full w-11 items-center justify-center text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))]"
          aria-label="Minimize"
        >
          <MinimizeIcon className="h-[15px] w-[15px]" />
        </button>
        <button
          onClick={handleMaximize}
          className="flex h-full w-11 items-center justify-center text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text))]"
          aria-label={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? <RestoreIcon className="h-[13px] w-[13px]" /> : <MaximizeIcon className="h-[13px] w-[13px]" />}
        </button>
        <button
          onClick={handleClose}
          className="flex h-full w-11 items-center justify-center text-[rgb(var(--text-muted))] transition-colors duration-150 hover:bg-red-600 hover:text-white"
          aria-label="Close"
        >
          <CloseIcon className="h-[15px] w-[15px]" />
        </button>
      </div>
    </div>
  );
}
